const fs = require('fs');
const path = require('path');

const API_BASE = 'https://pokeapi.co/api/v2';

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

function formatName(str) {
  if (!str) return '';
  return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function run() {
  console.log("Fetching legal items...");
  const [holdableRes, activeRes] = await Promise.all([
    fetchWithRetry(`${API_BASE}/item-attribute/holdable`),
    fetchWithRetry(`${API_BASE}/item-attribute/holdable-active`)
  ]);

  const uniqueItems = new Set([
    ...holdableRes.items.map(i => formatName(i.name)),
    ...activeRes.items.map(i => formatName(i.name))
  ]);
  const legal_items = Array.from(uniqueItems).sort();
  console.log(`Found ${legal_items.length} legal items.`);

  console.log("Fetching Pokémon list from PokeAPI...");
  const listRes = await fetchWithRetry(`${API_BASE}/pokemon?limit=1500`);
  const results = listRes.results;
  
  const BANNED_KEYWORDS = [
    'articuno', 'zapdos', 'moltres', 'mewtwo', 'mew',
    'raikou', 'entei', 'suicune', 'lugia', 'ho-oh', 'celebi',
    'regirock', 'regice', 'registeel', 'latias', 'latios', 'kyogre', 'groudon', 'rayquaza', 'jirachi', 'deoxys',
    'uxie', 'mesprit', 'azelf', 'dialga', 'palkia', 'heatran', 'regigigas', 'giratina', 'cresselia', 'phione', 'manaphy', 'darkrai', 'shaymin', 'arceus',
    'victini', 'cobalion', 'terrakion', 'virizion', 'tornadus', 'thundurus', 'reshiram', 'zekrom', 'landorus', 'kyurem', 'keldeo', 'meloetta', 'genesect',
    'xerneas', 'yveltal', 'zygarde', 'diancie', 'hoopa', 'volcanion',
    'type-null', 'silvally', 'tapu',
    'cosmog', 'cosmoem', 'solgaleo', 'lunala', 'nihilego', 'buzzwole', 'pheromosa', 'xurkitree', 'celesteela', 'kartana', 'guzzlord', 'necrozma', 'magearna', 'marshadow', 'poipole', 'naganadel', 'stakataka', 'blacephalon', 'zeraora', 'meltan', 'melmetal',
    'zacian', 'zamazenta', 'eternatus', 'kubfu', 'urshifu', 'zarude', 'regieleki', 'regidrago', 'glastrier', 'spectrier', 'calyrex',
    'enamorus', 'wo-chien', 'chien-pao', 'ting-lu', 'chi-yu', 'okidogi', 'munkidori', 'fezandipiti', 'ogerpon', 'terapagos', 'pecharunt',
    'gholdengo',
    // Paradoxes
    'great-tusk', 'scream-tail', 'brute-bonnet', 'flutter-mane', 'slither-wing', 'sandy-shocks', 'roaring-moon', 'walking-wake', 'gouging-fire', 'raging-bolt',
    'iron-'
  ];

  const filtered = results.filter(p => {
    if (p.name.includes('-mega') || p.name.includes('-gmax') || p.name.includes('-totem') || p.name.includes('-starter')) {
      return false;
    }
    const nameLower = p.name.toLowerCase();
    return !BANNED_KEYWORDS.some(k => nameLower.includes(k));
  });
  
  console.log(`Fetching details for ${filtered.length} Pokémon... this may take a moment.`);
  
  const compressedPokemon = [];
  const globalUniqueMoves = new Set();
  
  const BATCH_SIZE = 50;
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (p) => {
      try {
        const details = await fetchWithRetry(p.url);
        
        const types = details.types.map(t => formatName(t.type.name));
        const abilities = details.abilities.map(a => formatName(a.ability.name));
        
        const baseStats = {};
        details.stats.forEach(s => {
          let statName = s.stat.name;
          if (statName === 'hp') statName = 'hp';
          else if (statName === 'attack') statName = 'atk';
          else if (statName === 'defense') statName = 'def';
          else if (statName === 'special-attack') statName = 'spa';
          else if (statName === 'special-defense') statName = 'spd';
          else if (statName === 'speed') statName = 'spe';
          baseStats[statName] = s.base_stat;
        });

        const moves = details.moves.map(m => formatName(m.move.name));
        moves.forEach(m => globalUniqueMoves.add(m));

        compressedPokemon.push({
          name: formatName(details.name),
          types,
          baseStats,
          abilities,
          moves
        });
      } catch (err) {
        console.error(`\nFailed to fetch details for ${p.name}: ${err.message}`);
      }
    });
    
    await Promise.all(promises);
    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, filtered.length)} / ${filtered.length}`);
  }
  
  console.log('\nProcessing complete.');
  
  compressedPokemon.sort((a, b) => a.name.localeCompare(b.name));
  const legal_moves = Array.from(globalUniqueMoves).sort();
  
  const finalDatabase = {
    pokemon: compressedPokemon,
    legal_items,
    legal_moves
  };
  
  const outDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'meta_data.json');
  fs.writeFileSync(outPath, JSON.stringify(finalDatabase, null, 2));
  
  console.log(`Saved comprehensive database to src/data/meta_data.json`);
  console.log(`- ${compressedPokemon.length} Pokémon`);
  console.log(`- ${legal_items.length} Legal Items`);
  console.log(`- ${legal_moves.length} Legal Moves`);
}

run().catch(console.error);
