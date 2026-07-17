import os

def fix_double_encoded_utf8(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    fixed = content
    
    # Known double-encoded patterns:
    # Original char's UTF-8 bytes were misinterpreted as cp1252, then each byte was UTF-8 encoded.
    replacements = {
        # Em dash '—' (E2 80 94) corrupted two ways:
        '\u00e2\u20ac\u201d': '\u2014',   # â€" (94 as cp1252 char ”)
        '\u00e2\u201d\u20ac': '\u2014',   # â€ (byte order variant)
        
        # Bullet '•' (E2 80 A2):
        '\u00e2\u20ac\u00a2': '\u2022',   # â€¢
        
        # Right single quote ''' (E2 80 99):
        '\u00e2\u20ac\u2122': "'",         # â€™
        
        # Left double quote '"' (E2 80 9C):
        '\u00e2\u20ac\u0153': '\u201c',   # â€œ
        
        # Right double quote '"' (E2 80 9D):
        '\u00e2\u20ac\u009d': '\u201d',   # â€
        
        # Lightning '⚡' (E2 9A A1):
        '\u00e2\u0161\u00a1': '\u26a1',   # âš¡
        
        # Close X '✕' (E2 9C 95):
        '\u00e2\u0153\u2022': '\u2715',   # âœ•
        
        # Warning '⚠' (E2 9A A0):
        '\u00e2\u0161\u00a0': '\u26a0',   # âš 
        
        # Up triangle '▲' (E2 96 B2):
        '\u00e2\u2013\u00b2': '\u25b2',   # â–²
        
        # Circle '●' (E2 97 8F):
        '\u00e2\u2014\u008f': '\u25cf',   # â—
        
        # Star '✦' (E2 9C A6):
        '\u00e2\u0153\u00a6': '\u2726',   # âœ¦
        
        # Right arrow '→' (E2 86 92):
        '\u00e2\u2020\u2122': '\u2192',   # â†'
        
        # Skull '☠' (E2 98 A0):
        '\u00e2\u02dc\u00a0': '\u2620',   # â˜ 
        
        # En dash '–' (E2 80 93):
        '\u00e2\u20ac\u0153': '\u2013',   # â€" (93 as cp1252 char "")
        
        # Checkmark '✓' alternative or similar:
        '\u00e2\u0153\u00a8': '\u2713',   # âœ¨ -> checkmark variant
        
        # Box drawing '─' (E2 94 80):
        '\u00e2\u201d\u0152': '\u2500',   # â' -> box drawing horizontal
    }
    
    for old, new in replacements.items():
        if old in fixed:
            count = fixed.count(old)
            fixed = fixed.replace(old, new)
            print(f'  [{filepath}] Replaced {count}x {repr(old)} -> {repr(new)}')
    
    if fixed != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed)
        return True
    return False

src_dir = r'd:\Projects\PokeWarRoom\src'
changed = 0
for root, dirs, files in os.walk(src_dir):
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, src_dir)
            print(f'Checking {rel}...')
            if fix_double_encoded_utf8(fp):
                changed += 1
                print(f'  >>> FIXED: {rel}')
            else:
                print(f'  clean')

print(f'\nDone. {changed} files fixed.')
