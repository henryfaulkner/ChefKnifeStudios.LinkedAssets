const instances = new Map();
let sequence = 0;
export function create(element, callbacks, theme) {
    const cy = cytoscape({container:element, elements:[], layout:{name:'preset',fit:false},pan:{x:0,y:0},zoom:1,minZoom:0.2, maxZoom:3,
        wheelSensitivity:0.2, desktopTapThreshold:4, touchTapThreshold:4, boxSelectionEnabled:false,
        selectionType:'single', autoungrabify:true, pixelRatio:'auto', style:[
            {selector:'node:childless',style:{width:8,height:8,'background-color':'data(color)',label:'data(label)',
                'font-family':'Roboto','font-size':12,color:theme.foreground,'text-valign':'top','text-margin-y':-7,
                'text-events':'yes','overlay-padding':10,'overlay-opacity':0}},
            {selector:':parent',style:{'background-opacity':0,'border-opacity':0,'border-width':1,'border-color':theme.foreground,'compound-sizing-wrt-labels':'include',padding:22,label:''}},
            {selector:':parent.chosen',style:{'border-opacity':0.6,'border-color':theme.foreground}},
            {selector:'edge',style:{width:1.5,'line-color':'data(color)','curve-style':'straight','overlay-padding':10,'overlay-opacity':0}}
        ]});
    const state={cy,element,callbacks,revision:0,dead:false,gesture:null,suppressUntil:0,space:false,
        abort:new AbortController(),viewportTimer:null};
    const signal=state.abort.signal;
    const invoke=(name,...args)=>{if(!state.dead)callbacks.invokeMethodAsync(name,...args).catch(()=>{});};
    state.invoke=invoke;
    const groupFor=target=>target.isEdge()?cy.getElementById(target.data('parentId')):target.isParent()?target:target.parent();
    state.commit=group=>{
        const layout=state.groups?.get(group?.data('key'));if(layout)layout.measurement=null;
        if(group?.length)invoke('LayoutCommitted',group.data('key'),group.children().map(n=>({deviceId:n.data('deviceId'),x:n.position('x'),y:n.position('y')})),state.revision);
    };
    cy.on('tap','node,edge',event=>{
        if(performance.now()<state.suppressUntil)return;
        const group=groupFor(event.target);
        if(group.length){element.focus({preventScroll:true});invoke('LinkSelected',group.data('key'),state.revision);}
    });
    cy.on('mouseover','node,edge',event=>{if(!state.gesture)groupFor(event.target).style('border-opacity',0.6);});
    cy.on('mouseout','node,edge',event=>{if(!state.gesture){const group=groupFor(event.target);group.style('border-opacity',group.hasClass('chosen')?0.6:0);}});
    cy.on('mousedown touchstart','node,edge',event=>{
        const original=event.originalEvent;
        if(original.touches?.length>1){state.finish();return;}
        if(state.gesture)return;
        state.suppressUntil=0;
        if(state.space||original.button===1)return;
        const point=original.touches?.[0]??original;
        const group=groupFor(event.target);
        const nodes=event.target.isNode()&&!event.target.isParent()?event.target:group.children();
        state.gesture={kind:'move',group,x:point.clientX,y:point.clientY,zoom:cy.zoom(),
            positions:nodes.map(n=>({node:n,p:{...n.position()}})),moved:false};
        cy.userPanningEnabled(false);
    });
    element.addEventListener('pointerdown',event=>{
        if(!state.space&&event.button!==1)return;
        event.preventDefault();event.stopImmediatePropagation();
        state.gesture={kind:'pan',x:event.clientX,y:event.clientY,pan:{...cy.pan()},moved:false};
        cy.userPanningEnabled(false);
    },{capture:true,signal});
    element.addEventListener('touchstart',event=>{if(event.touches.length>1)state.finish();},{capture:true,signal,passive:true});
    const move=event=>{
        const g=state.gesture;if(!g)return;
        const p=event.touches?.[0]??event;
        const dx=p.clientX-g.x,dy=p.clientY-g.y;
        if(Math.hypot(dx,dy)>4)g.moved=true;
        if(!g.moved)return;
        if(event.cancelable)event.preventDefault();
        g.dx=dx;g.dy=dy;
        if(!state.frame)state.frame=requestAnimationFrame(()=>{state.frame=null;state.paintGesture();});
    };
    state.paintGesture=()=>{const g=state.gesture;if(!g?.moved)return;
        if(g.kind==='pan')cy.pan({x:g.pan.x+g.dx,y:g.pan.y+g.dy});
        else cy.batch(()=>g.positions.forEach(({node,p})=>node.position({x:p.x+g.dx/g.zoom,y:p.y+g.dy/g.zoom})));
    };
    state.finish=()=>{
        if(state.frame){cancelAnimationFrame(state.frame);state.frame=null;}state.paintGesture();
        const g=state.gesture;state.gesture=null;
        if(g?.moved){state.suppressUntil=performance.now()+120;if(g.group){state.commit(g.group);g.group.style('border-opacity',g.group.hasClass('chosen')?0.6:0);}}
        cy.userPanningEnabled(true);
    };
    window.addEventListener('pointermove',move,{signal,passive:false});
    window.addEventListener('touchmove',move,{signal,passive:false});
    for(const event of ['pointerup','pointercancel','touchend','touchcancel','blur'])window.addEventListener(event,state.finish,{signal});
    window.addEventListener('keydown',event=>{
        if(event.target.closest?.('input,textarea,select,button,a,summary,[contenteditable="true"]'))return;
        if(event.code==='Space'){state.space=true;event.preventDefault();}
    },{signal});
    window.addEventListener('keyup',event=>{if(event.code==='Space')state.space=false;},{signal});
    cy.on('pan zoom',()=>{
        clearTimeout(state.viewportTimer);
        state.viewportTimer=setTimeout(()=>invoke('ViewportCommitted',cy.pan(),cy.zoom(),state.revision),120);
    });
    state.observer=new ResizeObserver(()=>cy.resize());state.observer.observe(element);
    const id=++sequence;instances.set(id,state);return id;
}
function get(id){const s=instances.get(id);if(!s||s.dead)throw new Error('Canvas disposed');return s;}
function command(id,revision){const s=get(id);if(revision<s.revision)return null;s.finish();s.revision=revision;return s;}
export function replaceSnapshot(id,revision,graphs,retainedPositions) {
    const s=command(id,revision);if(!s)return;const cy=s.cy;
    const previous=new Map(cy.nodes(':childless').map(n=>[n.id(),{...n.position()}]));
    for(const [key,value] of Object.entries(retainedPositions??{}))previous.set(key,value);
    const elements=[];
    let retainedNodes=0;
    for(const graph of graphs){
        elements.push({data:{id:graph.parentId,key:graph.key}});
        const measure=document.createElement('canvas').getContext('2d');measure.font='12px Roboto';
        const labelWidth=Math.max(0,...graph.members.map(m=>measure.measureText(m.label).width));
        const radius=Math.max(40,16*graph.members.length,graph.members.length>2?labelWidth/(2*Math.sin(Math.PI/graph.members.length))+16:40);
        const existing=graph.members.map(m=>previous.get(m.id)).filter(Boolean);retainedNodes+=existing.length;
        const origin=existing.length?{x:existing.reduce((sum,p)=>sum+p.x,0)/existing.length,y:existing.reduce((sum,p)=>sum+p.y,0)/existing.length}:{x:0,y:0};
        graph.members.forEach((member,i)=>{
            const angle=graph.members.length===2?Math.PI/4+i*Math.PI:2*Math.PI*i/graph.members.length-Math.PI/2;
            elements.push({data:{id:member.id,parent:graph.parentId,deviceId:member.deviceId,label:member.label,color:graph.color},
                position:previous.get(member.id)??{x:origin.x+Math.cos(angle)*radius,y:origin.y+Math.sin(angle)*radius}});
        });
        for(const edge of graph.edges)elements.push({data:{id:edge.id,source:edge.source,target:edge.target,parentId:graph.parentId,color:graph.color}});
    }
    cy.batch(()=>{cy.elements().remove();cy.add(elements);});
    s.groups=new Map(graphs.map(g=>[g.key,{parent:cy.getElementById(g.parentId)}]));
    const newKeys=graphs.filter(g=>!g.members.some(m=>previous.has(m.id))).map(g=>g.key);
    if(retainedNodes===0)arrange(id,revision,graphs.map(g=>g.key));
    else if(newKeys.length){
        const bottom=Math.max(120,cy.elements().boundingBox().y2+80);
        pack(s,newKeys,bottom);
    }
    return capture(id);
}
function pack(s,keys,top=220){
    const cy=s.cy;const width=Math.max(320,s.element.clientWidth);
    // Geometry reads must precede the mutation batch: compound bounds/label caches
    // are deliberately deferred by Cytoscape while a batch is open.
    const measured=keys.map(key=>{
        const group=s.groups.get(key);
        if(!group?.parent.length||group.hidden)return null;
        const children=group.parent.children(),positions=children.map(n=>({...n.position()})),origin=positions[0];
        // Translations preserve measured dimensions and label offsets. Node edits and
        // snapshot replacement invalidate these values before the next arrangement.
        if(!group.measurement){
            const bounds=children.boundingBox({includeLabels:true});
            group.measurement={x:bounds.x1-24-origin.x,y:bounds.y1-24-origin.y,w:bounds.w+48,h:bounds.h+48};
        }
        const m=group.measurement,box={x1:origin.x+m.x,y1:origin.y+m.y,w:m.w,h:m.h};
        return{key,children,positions,box};
    }).filter(Boolean);
    if(!measured.length)return[];
    const cellWidth=Math.max(...measured.map(g=>g.box.w));
    const cellHeight=Math.max(...measured.map(g=>g.box.h));
    const columns=Math.max(1,Math.min(measured.length,Math.floor((width-96+80)/(cellWidth+80))));
    const moved=[],movedKeys=[];
    cy.batch(()=>{
        measured.forEach(({key,children,positions,box},index)=>{
            const x=48+(index%columns)*(cellWidth+80),y=top+Math.floor(index/columns)*(cellHeight+80);
            const dx=x-box.x1,dy=y-box.y1;
            if(Math.abs(dx)<1e-8&&Math.abs(dy)<1e-8)return;
            children.silentPositions((n,i)=>({x:positions[i].x+dx,y:positions[i].y+dy}));
            moved.push(...children);
            movedKeys.push(key);
        });
        cy.collection(moved).emit('position');
    });
    if(moved.length)cy.forceRender();
    return movedKeys;
}
export function capture(id){const s=get(id);s.finish();return [...s.groups].map(([key,g])=>({key,positions:g.parent.children().map(n=>({deviceId:n.data('deviceId'),x:n.position('x'),y:n.position('y')}))}));}
export function captureActive(id){const s=get(id),group=s.gesture?.moved?s.gesture.group:null;s.finish();return group?[{key:group.data('key'),positions:group.children().map(n=>({deviceId:n.data('deviceId'),x:n.position('x'),y:n.position('y')}))}]:[];}
export function arrange(id,revision,keys){const s=command(id,revision);if(!s)return[];pack(s,keys);return capture(id);}
export function setVisible(id,revision,keys,reflow=true){
    const s=command(id,revision);if(!s)return[];const visible=new Set(keys);
    const hide=[],show=[];
    for(const [key,group] of s.groups){const hidden=!visible.has(key);if(Boolean(group.hidden)!==hidden)(hidden?hide:show).push(group.parent[0]);}
    // display:none also hides descendant nodes and their edges, retaining positions.
    s.cy.batch(()=>{
        s.cy.collection(hide).style('display','none');s.cy.collection(show).style('display','element');
        for(const [key,group] of s.groups)group.hidden=!visible.has(key);
    });
    if(!reflow)return[];
    const moved=new Set(pack(s,keys));
    return capture(id).filter(change=>moved.has(change.key));
}
export function setSelection(id,revision,key){
    const s=command(id,revision);if(!s)return;
    s.cy.batch(()=>{s.cy.nodes(':parent').removeClass('chosen').style('border-opacity',0);if(key)s.cy.nodes(':parent').filter(n=>n.data('key')===key).addClass('chosen').style('border-opacity',0.6);});
}
export function setTheme(id,theme,graphs){const s=get(id);s.cy.batch(()=>{
    for(const graph of graphs){s.cy.nodes(':parent').filter(n=>n.data('key')===graph.key).descendants().data('color',graph.color);s.cy.edges().filter(e=>e.data('parentId')===graph.parentId).data('color',graph.color);}
    s.cy.style().selector('node:childless').style('color',theme.foreground).selector(':parent').style('border-color',theme.foreground).selector(':parent.chosen').style('border-color',theme.foreground).update();
});}
export function navigate(id,action,key,deviceId,dx=0,dy=0){
    const s=get(id),cy=s.cy;
    const parent=cy.nodes(':parent').filter(n=>n.data('key')===key);
    if(action==='nudge'&&parent.length){const nodes=deviceId?parent.children().filter(n=>n.data('deviceId')===deviceId):parent.children();nodes.shift({x:dx,y:dy});s.commit(parent);}
    if(action==='center'&&parent.length)cy.center(parent);
    if(action==='fit'){const visible=cy.elements().filter(e=>e.visible());if(visible.length)cy.fit(visible,100);}
    if(action==='in'||action==='out')cy.zoom({level:Math.max(0.2,Math.min(3,cy.zoom()*(action==='in'?1.2:1/1.2))),renderedPosition:{x:cy.width()/2,y:cy.height()/2}});
}
export function dispose(id){const s=instances.get(id);if(!s)return;s.finish();s.dead=true;clearTimeout(s.viewportTimer);s.abort.abort();s.observer.disconnect();s.cy.destroy();instances.delete(id);}
