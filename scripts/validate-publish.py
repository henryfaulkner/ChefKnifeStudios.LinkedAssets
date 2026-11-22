"""Validate the static artifact without accessing Geotab or any account."""
import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
assert (root / 'index.html').is_file()
assert any((root / '_framework').glob('*.wasm')), 'No browser WASM runtime'
for assembly in ('Core', 'Shared', 'WebApp'):
    assert len(list((root / '_framework').glob(f'ChefKnifeStudios.LinkedAssets.Client.{assembly}.*.wasm'))) == 1, 'Stale assembly fingerprints in publish output'
config = json.loads((root / 'staticwebapp.config.json').read_text(encoding='utf-8-sig'))
assert config['globalHeaders']['Blazor-Environment'] == 'Production'
assert config['mimeTypes']['.wasm'] == 'application/wasm'
assert '/_framework/*' in config['navigationFallback']['exclude']
assert '/_content/*' in config['navigationFallback']['exclude']
for path in root.rglob('*'):
    if path.is_file():
        assert not any(part.lower() in {'tests', 'fixtures', 'test-results'} for part in path.relative_to(root).parts), path
        assert path.name not in {'basic.json', 'manifest.json', 'fixtures.js'}, path
        if path.suffix in {'.json', '.html', '.js'}:
            text = path.read_text(encoding='utf-8-sig')
            assert 'synthetic-test' not in text and 'synthetic-only' not in text, path
settings = json.loads((root / 'appsettings.json').read_text(encoding='utf-8-sig'))
assert set(settings) == {'Map'}
assert set(settings['Map']) == {'LightStyleUrl', 'DarkStyleUrl'}
for suffix in ('.br', '.gz'):
    assert not (root / ('appsettings.json' + suffix)).exists(), 'Stale precompressed runtime configuration could override injected map settings'
print('Static WASM artifact, fallback rules, MIME types and fixture exclusion verified.')
