const maps=new Map();let sequence=0;
export function longitudeWindow(points){
    if(!points.length)return[];
    const sorted=points.map(p=>((p.longitude%360)+360)%360).sort((a,b)=>a-b);
    let gap=-1,start=sorted[0];
    sorted.forEach((value,i)=>{const next=i===sorted.length-1?sorted[0]+360:sorted[i+1];if(next-value>gap){gap=next-value;start=next%360;}});
    const values=points.map(p=>((p.longitude-start+360)%360)+start);
    const shift=Math.min(...values)>=180?360:0;
    return values.map(v=>v-shift);
}
function notify(s,message){if(!s.dead)s.callbacks.invokeMethodAsync('MapMessage',message,s.revision).catch(()=>{});}
function apply(s){
    if(s.dead||!s.map.isStyleLoaded()||s.element.clientWidth===0||s.element.clientHeight===0)return;
    s.pending=false;
    try{
        const supported=s.points.filter(p=>Math.abs(p.latitude)<=85.0511287798066);
        if(supported.length!==s.points.length)notify(s,'Some reported positions are outside this map projection. Their source coordinates remain in the report list.');
        else notify(s,s.points.length?'':'No reported positions available.');
        const longitudes=longitudeWindow(supported);
        const data={type:'FeatureCollection',features:supported.map((p,i)=>({type:'Feature',geometry:{type:'Point',coordinates:[longitudes[i],p.latitude]},properties:{deviceId:p.deviceId,name:p.label}}))};
        const source=s.map.getSource('members');
        if(source)source.setData(data);else s.map.addSource('members',{type:'geojson',data});
        const pinColor=s.dark?'#90A4AE':'#37474F';
        if(!s.map.hasImage('member-pin')||s.pinColor!==pinColor){
            const canvas=document.createElement('canvas');canvas.width=24;canvas.height=34;
            const ctx=canvas.getContext('2d');ctx.fillStyle=pinColor;ctx.beginPath();ctx.arc(12,12,10,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.moveTo(5,18);ctx.lineTo(12,33);ctx.lineTo(19,18);ctx.fill();ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(12,12,4,0,Math.PI*2);ctx.fill();
            const icon=ctx.getImageData(0,0,24,34);
            if(s.map.hasImage('member-pin'))s.map.updateImage('member-pin',icon);else s.map.addImage('member-pin',icon);
            s.pinColor=pinColor;
        }
        if(!s.map.getLayer('member-pins'))s.map.addLayer({id:'member-pins',type:'symbol',source:'members',layout:{'icon-image':'member-pin','icon-anchor':'bottom','icon-allow-overlap':true}});
        s.labels.forEach(marker=>marker.remove());s.labels=[];
        supported.forEach((point,i)=>{
            const label=document.createElement('span');label.className='map-device-label';label.textContent=point.label;
            s.labels.push(new maplibregl.Marker({element:label,anchor:'top',offset:[0,5]}).setLngLat([longitudes[i],point.latitude]).addTo(s.map));
        });
        s.map.resize();
        if(supported.length){
            const latitudes=supported.map(p=>p.latitude);
            const west=Math.min(...longitudes),east=Math.max(...longitudes),south=Math.min(...latitudes),north=Math.max(...latitudes);
            if(west===east&&south===north)s.map.jumpTo({center:[west,south],zoom:14});
            else s.map.fitBounds([[west,south],[east,north]],{padding:40,maxZoom:14,duration:0});
        }
    }catch{notify(s,'The map could not render these positions. Report details remain available.');}
}
export function create(element,callbacks,configuration,dark){
    const id=++sequence;
    const s={id,element,callbacks,configuration,dark,revision:0,points:[],labels:[],dead:false,map:null,observer:null,pending:true};
    maps.set(id,s);
    const style=dark?configuration.darkStyleUrl:configuration.lightStyleUrl;
    if(!style){notify(s,'Map styles are not configured. Report details remain available.');return id;}
    try{
        if(typeof maplibregl.supported==='function'&&!maplibregl.supported()){notify(s,'WebGL is unavailable. Report details remain available.');return id;}
        s.map=new maplibregl.Map({container:element,style,interactive:false,dragRotate:false,pitchWithRotate:false,
            center:[0,0],zoom:0,minZoom:0,maxZoom:18,attributionControl:true});
        s.map.on('load',()=>{s.pending=true;apply(s);});s.map.on('style.load',()=>{s.pending=true;apply(s);});
        s.map.on('idle',()=>{if(s.pending)apply(s);});
        s.map.on('error',()=>notify(s,'Map tiles or styles could not load. Report details remain available.'));
        s.observer=new ResizeObserver(()=>{if(s.map&&!s.dead)apply(s);});s.observer.observe(element);
    }catch{notify(s,'The map could not start. Report details remain available.');}
    return id;
}
export function update(id,revision,points){const s=maps.get(id);if(!s||s.dead||revision<s.revision)return;
    if(revision!==s.revision)s.map?.getSource('members')?.setData({type:'FeatureCollection',features:[]});
    s.revision=revision;s.points=points;s.pending=true;s.labels.forEach(m=>m.remove());s.labels=[];if(s.map)apply(s);}
export function setTheme(id,dark){const s=maps.get(id);if(!s||s.dead||s.dark===dark)return;s.dark=dark;
    const style=dark?s.configuration.darkStyleUrl:s.configuration.lightStyleUrl;
    if(!style){notify(s,'Map styles are not configured. Report details remain available.');return;}
    // Runtime member layers are absent from the provider style. A full swap gives
    // one style.load boundary even when MapLibre could otherwise apply a diff.
    s.pending=true;
    if(s.map)s.map.setStyle(style,{diff:false});else notify(s,'Retry the map to apply its configuration.');
}
export function dispose(id){const s=maps.get(id);if(!s)return;s.dead=true;s.observer?.disconnect();s.labels.forEach(m=>m.remove());s.map?.remove();maps.delete(id);}
