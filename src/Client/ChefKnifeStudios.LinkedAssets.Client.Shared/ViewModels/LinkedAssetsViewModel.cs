using System.Collections.Immutable;
using ChefKnifeStudios.LinkedAssets.Client.Core.Graph;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
using ChefKnifeStudios.LinkedAssets.Client.Core.Services;
using CommunityToolkit.Mvvm.ComponentModel;

namespace ChefKnifeStudios.LinkedAssets.Client.Shared.ViewModels;

public sealed partial class LinkedAssetsViewModel(GeotabSessionService session, LinkedAssetsService data,
    DeviceStatusService statuses, TimeProvider clock) : BaseViewModel, IDisposable
{
    [ObservableProperty] private LinkSnapshot? _snapshot;
    [ObservableProperty] private LoadState _state = LoadState.Loading;
    [ObservableProperty] private string? _message;
    [ObservableProperty] private LinkRecord? _selected;
    [ObservableProperty] private ImmutableDictionary<string, DeviceSnapshot> _memberStatuses = ImmutableDictionary<string,DeviceSnapshot>.Empty;
    [ObservableProperty] private string _query = "";
    [ObservableProperty] private ImmutableHashSet<LinkType> _enabledTypes = Enum.GetValues<LinkType>().ToImmutableHashSet();
    public Dictionary<string,Dictionary<string,NodePosition>> Layouts { get; } = new(StringComparer.Ordinal);
    public GraphViewport Viewport {get;set;}=new(0,0,1);
    public long SnapshotGeneration { get; private set; }
    private long _selectionGeneration;
    private CancellationTokenSource _load = new(), _selection = new();
    private bool _disposed;
    public IEnumerable<LinkRecord> VisibleLinks => LinkProjection.Filter(Snapshot?.Links ?? [],Query,EnabledTypes);
    public void Toggle(LinkType type) => EnabledTypes = EnabledTypes.Contains(type) ? EnabledTypes.Remove(type) : EnabledTypes.Add(type);
    partial void OnQueryChanged(string value) => FilterChanged();
    partial void OnEnabledTypesChanged(ImmutableHashSet<LinkType> value) => FilterChanged();
    private void FilterChanged()
    {
        if(Selected is { } selected&&!VisibleLinks.Any(l=>l.Key==selected.Key))ClearSelection();
        OnPropertyChanged(nameof(VisibleLinks));
    }
    public async Task RefreshAsync()
    {
        if(_disposed||session.Current is not { } current)return;
        _load.Cancel();_load.Dispose();_load=new();var token=_load.Token;
        _selection.Cancel();Close();var generation=++SnapshotGeneration;
        statuses.Reset(generation);State=LoadState.Loading;Message=null;
        var selectedKey=_lastSelectedKey;
        try
        {
            var snapshot=await data.LoadAsync(current,token);
            if(_disposed||token.IsCancellationRequested||generation!=SnapshotGeneration||session.Current!=current)return;
            if(snapshot.State==LoadState.Failed){State=LoadState.Failed;Message="Both link sources failed. Any displayed snapshot is from the previous successful refresh.";return;}
            Snapshot=snapshot;State=snapshot.State;
            var keys=snapshot.Links.Select(l=>l.Key).ToHashSet(StringComparer.Ordinal);
            foreach(var key in Layouts.Keys.Where(k=>!keys.Contains(k)).ToArray())Layouts.Remove(key);
            foreach(var link in snapshot.Links)if(Layouts.TryGetValue(link.Key,out var positions))
                foreach(var id in positions.Keys.Where(id=>!link.Members.Any(m=>m.DeviceId==id)).ToArray())positions.Remove(id);
            if(selectedKey is not null&&VisibleLinks.FirstOrDefault(l=>l.Key==selectedKey) is { } selected)await SelectAsync(selected.Key);
        }
        catch(OperationCanceledException)when(token.IsCancellationRequested){ }
        catch(GeotabException ex)when(ex.Failure==ReadFailure.Expired){if(generation==SnapshotGeneration){await ResetAsync();State=LoadState.Expired;Message="Your Geotab session expired. Sign in again.";}}
        catch(GeotabException){if(generation==SnapshotGeneration){State=LoadState.Failed;Message="Refresh failed. Any displayed snapshot is from the previous successful refresh.";}}
        finally{if(generation==SnapshotGeneration)OnPropertyChanged(nameof(VisibleLinks));}
    }
    private string? _lastSelectedKey;
    public async Task SelectAsync(string key)
    {
        if(_disposed||session.Current is not { } current)return;
        var link=VisibleLinks.FirstOrDefault(l=>l.Key==key);if(link is null)return;
        _selection.Cancel();_selection.Dispose();_selection=new();var token=_selection.Token;
        var selectionGeneration=++_selectionGeneration;var snapshotGeneration=SnapshotGeneration;
        Selected=link;_lastSelectedKey=link.Key;
        MemberStatuses=link.Members.ToImmutableDictionary(m=>m.DeviceId,m=>DeviceSnapshot.Loading(m.DeviceId),StringComparer.Ordinal);
        async Task ReadMember(LinkMember member)
        {
            try
            {
                var result=await statuses.GetAsync(current,member.DeviceId,snapshotGeneration,token);
                if(_disposed||token.IsCancellationRequested||snapshotGeneration!=SnapshotGeneration||selectionGeneration!=_selectionGeneration||Selected?.Key!=key)return;
                MemberStatuses=MemberStatuses.SetItem(member.DeviceId,result);
            }
            catch(OperationCanceledException)when(token.IsCancellationRequested){ }
            catch(GeotabException ex)when(ex.Failure==ReadFailure.Expired)
            {if(snapshotGeneration==SnapshotGeneration&&selectionGeneration==_selectionGeneration){await ResetAsync();State=LoadState.Expired;Message="Your Geotab session expired. Sign in again.";}}
        }
        await Task.WhenAll(link.Members.Select(ReadMember));
    }
    public void Close(){++_selectionGeneration;_selection.Cancel();Selected=null;MemberStatuses=ImmutableDictionary<string,DeviceSnapshot>.Empty;}
    public void ClearSelection(){_lastSelectedKey=null;Close();}
    public async Task ResetAsync()
    {
        _load.Cancel();++SnapshotGeneration;ClearSelection();statuses.Reset(SnapshotGeneration);
        Snapshot=null;Layouts.Clear();Viewport=new(0,0,1);Query="";EnabledTypes=Enum.GetValues<LinkType>().ToImmutableHashSet();Message=null;
        await session.SignOutAsync();
    }
    public void Commit(string key,NodePosition[] positions)
    {if(Snapshot?.Links.Any(l=>l.Key==key)==true)Layouts[key]=positions.ToDictionary(p=>p.DeviceId,StringComparer.Ordinal);}
    public bool HasKnownBoundaryPassed() => Snapshot is { } snapshot&&snapshot.Links.SelectMany(l=>l.Periods)
        .Any(p=>(p.Start>snapshot.FetchedAt&&p.Start<=clock.GetUtcNow())||(p.End>snapshot.FetchedAt&&p.End<=clock.GetUtcNow()));
    public DateTimeOffset? NextBoundary => Snapshot?.Links.SelectMany(l=>l.Periods).SelectMany(p=>new[]{p.Start,p.End})
        .Where(t=>t>clock.GetUtcNow()&&t.Value.Year<9999).Min();
    public void Dispose(){_disposed=true;_load.Cancel();_selection.Cancel();_load.Dispose();_selection.Dispose();}
}
