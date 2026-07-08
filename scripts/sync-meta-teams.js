const fs = require('fs');
const path = require('path');

const TEAMS = [
  {
    name: "Charizard-Y Sun Offense",
    description: "Standard Regulation M-B Sun core featuring Mega Charizard Y for immediate weather control and Flutter Mane for fast special pressure.",
    paste: `Charizard-Mega-Y @ Charizardite Y  
Ability: Drought  
Level: 50  
Tera Type: Fire  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Heat Wave  
- Solar Beam  
- Tailwind  
- Protect  

Flutter Mane @ Choice Specs  
Ability: Protosynthesis  
Level: 50  
Tera Type: Fairy  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Dazzling Gleam  
- Moonblast  
- Shadow Ball  
- Icy Wind  

Gouging Fire @ Booster Energy  
Ability: Protosynthesis  
Level: 50  
Tera Type: Grass  
EVs: 252 Atk / 4 SpD / 252 Spe  
Jolly Nature  
- Heat Crash  
- Dragon Claw  
- Howl  
- Protect  

Raging Bolt @ Assault Vest  
Ability: Protosynthesis  
Level: 50  
Tera Type: Electric  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Thunderclap  
- Thunderbolt  
- Draco Meteor  
- Snarl  

Ogerpon-Hearthflame (F) @ Hearthflame Mask  
Ability: Mold Breaker  
Level: 50  
Tera Type: Fire  
EVs: 252 Atk / 4 SpD / 252 Spe  
Jolly Nature  
- Ivy Cudgel  
- Horn Leech  
- Spiky Shield  
- Follow Me  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot`
  },
  {
    name: "Archaludon Rain",
    description: "Bulky Rain setup utilizing Pelipper's Drizzle and Archaludon's Stamina + Electro Shot to snowball out of control.",
    paste: `Archaludon @ Assault Vest  
Ability: Stamina  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Electro Shot  
- Flash Cannon  
- Draco Meteor  
- Body Press  

Pelipper @ Focus Sash  
Ability: Drizzle  
Level: 50  
Tera Type: Ghost  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Hurricane  
- Weather Ball  
- Tailwind  
- Protect  

Urshifu-Rapid-Strike @ Choice Scarf  
Ability: Unseen Fist  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Surging Strikes  
- Close Combat  
- Aqua Jet  
- U-turn  

Rillaboom @ Assault Vest  
Ability: Grassy Surge  
Level: 50  
Tera Type: Fire  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Wood Hammer  
- Grassy Glide  
- U-turn  
- Fake Out  

Kingambit @ Black Glasses  
Ability: Defiant  
Level: 50  
Tera Type: Dark  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Sucker Punch  
- Kowtow Cleave  
- Iron Head  
- Protect  

Amoonguss @ Rocky Helmet  
Ability: Regenerator  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Def / 4 SpD  
Bold Nature  
IVs: 0 Atk  
- Spore  
- Rage Powder  
- Pollen Puff  
- Protect`
  },
  {
    name: "Basculegion/Garchomp Offense",
    description: "Fast, aggressive physical offense focusing on rapid damage output and Swift Swim sweeping potential.",
    paste: `Basculegion (M) @ Choice Band  
Ability: Swift Swim  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 Atk / 252 Spe  
Adamant Nature  
- Wave Crash  
- Last Respects  
- Aqua Jet  
- Flip Turn  

Garchomp @ Clear Amulet  
Ability: Rough Skin  
Level: 50  
Tera Type: Steel  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Earthquake  
- Dragon Claw  
- Swords Dance  
- Protect  

Tornadus (M) @ Covert Cloak  
Ability: Prankster  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Def / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Bleakwind Storm  
- Tailwind  
- Rain Dance  
- Protect  

Gholdengo @ Choice Specs  
Ability: Good as Gold  
Level: 50  
Tera Type: Steel  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Make It Rain  
- Shadow Ball  
- Trick  
- Protect  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Ogerpon-Wellspring (F) @ Wellspring Mask  
Ability: Water Absorb  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 4 Atk / 252 Spe  
Jolly Nature  
- Ivy Cudgel  
- Horn Leech  
- Follow Me  
- Spiky Shield`
  },
  {
    name: "Psyspam / Expanding Force",
    description: "Psychic Terrain hyper offense utilizing Indeedee-F for setup and Armarouge for devastating Expanding Force damage.",
    paste: `Indeedee-F (F) @ Psychic Seed  
Ability: Psychic Surge  
Level: 50  
Tera Type: Fairy  
EVs: 252 HP / 252 Def / 4 SpD  
Relaxed Nature  
IVs: 0 Atk / 0 Spe  
- Follow Me  
- Helping Hand  
- Trick Room  
- Protect  

Armarouge @ Life Orb  
Ability: Flash Fire  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 252 SpA / 4 SpD  
Quiet Nature  
IVs: 0 Atk / 0 Spe  
- Expanding Force  
- Armor Cannon  
- Trick Room  
- Protect  

Ursaluna @ Flame Orb  
Ability: Guts  
Level: 50  
Tera Type: Normal  
EVs: 252 HP / 252 Atk / 4 SpD  
Brave Nature  
IVs: 0 Spe  
- Facade  
- Headlong Rush  
- Swords Dance  
- Protect  

Torkoal @ Charcoal  
Ability: Drought  
Level: 50  
Tera Type: Fire  
EVs: 252 HP / 252 SpA / 4 SpD  
Quiet Nature  
IVs: 0 Atk / 0 Spe  
- Eruption  
- Heat Wave  
- Earth Power  
- Protect  

Gallade @ Clear Amulet  
Ability: Sharpness  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 252 Atk / 4 SpD  
Brave Nature  
IVs: 0 Spe  
- Sacred Sword  
- Psycho Cut  
- Wide Guard  
- Trick Room  

Hatterene (F) @ Focus Sash  
Ability: Magic Bounce  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 SpA / 4 SpD  
Quiet Nature  
IVs: 0 Atk / 0 Spe  
- Dazzling Gleam  
- Expanding Force  
- Trick Room  
- Protect`
  },
  {
    name: "Hard Trick Room Bloodmoon",
    description: "Standard Trick Room featuring Bloodmoon Ursaluna for massive spread damage under twisted dimensions.",
    paste: `Ursaluna-Bloodmoon (M) @ Silk Scarf  
Ability: Mind's Eye  
Level: 50  
Tera Type: Normal  
EVs: 252 HP / 252 SpA / 4 SpD  
Quiet Nature  
IVs: 0 Atk / 0 Spe  
- Blood Moon  
- Hyper Voice  
- Earth Power  
- Protect  

Farigiraf @ Sitrus Berry  
Ability: Armor Tail  
Level: 50  
Tera Type: Fairy  
EVs: 252 HP / 252 Def / 4 SpD  
Relaxed Nature  
IVs: 0 Atk / 0 Spe  
- Hyper Voice  
- Trick Room  
- Imprison  
- Helping Hand  

Iron Hands @ Assault Vest  
Ability: Quark Drive  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 252 Atk / 4 SpD  
Brave Nature  
IVs: 0 Spe  
- Fake Out  
- Drain Punch  
- Wild Charge  
- Heavy Slam  

Sinistcha @ Rocky Helmet  
Ability: Hospitality  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Def / 4 SpD  
Bold Nature  
IVs: 0 Atk  
- Matcha Gotcha  
- Trick Room  
- Rage Powder  
- Protect  

Incineroar @ Safety Goggles  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Ogerpon-Wellspring (F) @ Wellspring Mask  
Ability: Water Absorb  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Ivy Cudgel  
- Horn Leech  
- Spiky Shield  
- Follow Me`
  },
  {
    name: "Dozo / Giri Setup",
    description: "All-in setup core featuring Dondozo and Tatsugiri for massive omni-boosts, supported by standard redirection.",
    paste: `Dondozo @ Leftovers  
Ability: Unaware  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Wave Crash  
- Earthquake  
- Order Up  
- Protect  

Tatsugiri @ Choice Scarf  
Ability: Commander  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Muddy Water  
- Draco Meteor  
- Icy Wind  
- Sleep Talk  

Glimmora @ Focus Sash  
Ability: Toxic Debris  
Level: 50  
Tera Type: Grass  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Sludge Bomb  
- Earth Power  
- Mortal Spin  
- Spiky Shield  

Dragonite @ Choice Band  
Ability: Inner Focus  
Level: 50  
Tera Type: Normal  
EVs: 4 HP / 252 Atk / 252 Spe  
Adamant Nature  
- Extreme Speed  
- Outrage  
- Aerial Ace  
- Stomping Tantrum  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Ogerpon-Hearthflame (F) @ Hearthflame Mask  
Ability: Mold Breaker  
Level: 50  
Tera Type: Fire  
EVs: 252 HP / 4 Atk / 252 Spe  
Jolly Nature  
- Ivy Cudgel  
- Horn Leech  
- Spiky Shield  
- Follow Me`
  },
  {
    name: "Urshifu / Chien-Pao Aggro",
    description: "Physical hyper offense that pairs Chien-Pao's Sword of Ruin with Urshifu's Surging Strikes to delete bulk.",
    paste: `Chien-Pao @ Focus Sash  
Ability: Sword of Ruin  
Level: 50  
Tera Type: Ghost  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Icicle Crash  
- Sucker Punch  
- Sacred Sword  
- Protect  

Urshifu-Rapid-Strike @ Mystic Water  
Ability: Unseen Fist  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Surging Strikes  
- Close Combat  
- Aqua Jet  
- Protect  

Dragonite @ Choice Band  
Ability: Inner Focus  
Level: 50  
Tera Type: Normal  
EVs: 4 HP / 252 Atk / 252 Spe  
Adamant Nature  
- Extreme Speed  
- Outrage  
- Stomping Tantrum  
- Aerial Ace  

Rillaboom @ Assault Vest  
Ability: Grassy Surge  
Level: 50  
Tera Type: Fire  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Wood Hammer  
- Grassy Glide  
- U-turn  
- Fake Out  

Gholdengo @ Choice Specs  
Ability: Good as Gold  
Level: 50  
Tera Type: Steel  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Make It Rain  
- Shadow Ball  
- Trick  
- Protect  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot`
  },
  {
    name: "Articuno-Snow Veil Hail",
    description: "Snow-based defensive team using Alolan Ninetales to set Aurora Veil and enable Blizzard spam.",
    paste: `Ninetales-Alola (F) @ Light Clay  
Ability: Snow Warning  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Blizzard  
- Moonblast  
- Aurora Veil  
- Protect  

Articuno-Galar @ Choice Specs  
Ability: Competitive  
Level: 50  
Tera Type: Steel  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Freezing Glare  
- Hurricane  
- Shadow Ball  
- Trick  

Baxcalibur @ Loaded Dice  
Ability: Thermal Exchange  
Level: 50  
Tera Type: Poison  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Icicle Spear  
- Glaive Rush  
- Ice Shard  
- Protect  

Ogerpon-Wellspring (F) @ Wellspring Mask  
Ability: Water Absorb  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 4 Atk / 252 Spe  
Jolly Nature  
- Ivy Cudgel  
- Horn Leech  
- Spiky Shield  
- Follow Me  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Iron Hands @ Assault Vest  
Ability: Quark Drive  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Fake Out  
- Drain Punch  
- Wild Charge  
- Heavy Slam`
  },
  {
    name: "Calyrex-Shadow Fast Offense",
    description: "Restricted tier preview featuring Calyrex-Shadow for unmatched speed and spread damage via Astral Barrage.",
    paste: `Calyrex-Shadow @ Focus Sash  
Ability: As One (Spectrier)  
Level: 50  
Tera Type: Normal  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Astral Barrage  
- Expanding Force  
- Nasty Plot  
- Protect  

Indeedee-F (F) @ Psychic Seed  
Ability: Psychic Surge  
Level: 50  
Tera Type: Fairy  
EVs: 252 HP / 252 Def / 4 SpD  
Relaxed Nature  
IVs: 0 Atk / 0 Spe  
- Follow Me  
- Helping Hand  
- Trick Room  
- Protect  

Urshifu-Rapid-Strike @ Choice Scarf  
Ability: Unseen Fist  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Surging Strikes  
- Close Combat  
- Aqua Jet  
- U-turn  

Tornadus (M) @ Covert Cloak  
Ability: Prankster  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Def / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Bleakwind Storm  
- Tailwind  
- Taunt  
- Protect  

Chi-Yu @ Choice Specs  
Ability: Beads of Ruin  
Level: 50  
Tera Type: Ghost  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Heat Wave  
- Dark Pulse  
- Overheat  
- Snarl  

Ogerpon-Wellspring (F) @ Wellspring Mask  
Ability: Water Absorb  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Atk / 4 SpD  
Jolly Nature  
- Ivy Cudgel  
- Horn Leech  
- Spiky Shield  
- Follow Me`
  },
  {
    name: "Groudon Sun Balance",
    description: "Classic Groudon weather balance with Raging Bolt and Flutter Mane to abuse the harsh sunlight.",
    paste: `Groudon @ Clear Amulet  
Ability: Drought  
Level: 50  
Tera Type: Fire  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Precipice Blades  
- Heat Crash  
- Swords Dance  
- Protect  

Flutter Mane @ Booster Energy  
Ability: Protosynthesis  
Level: 50  
Tera Type: Fairy  
EVs: 252 HP / 252 SpA / 4 Spe  
Modest Nature  
IVs: 0 Atk  
- Dazzling Gleam  
- Moonblast  
- Shadow Ball  
- Protect  

Raging Bolt @ Assault Vest  
Ability: Protosynthesis  
Level: 50  
Tera Type: Electric  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Thunderclap  
- Thunderbolt  
- Draco Meteor  
- Snarl  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Rillaboom @ Miracle Seed  
Ability: Grassy Surge  
Level: 50  
Tera Type: Fire  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Wood Hammer  
- Grassy Glide  
- High Horsepower  
- Fake Out  

Walking Wake @ Life Orb  
Ability: Protosynthesis  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Hydro Steam  
- Draco Meteor  
- Flamethrower  
- Protect`
  },
  {
    name: "Kyogre Rain Bulky Offense",
    description: "Kyogre-led rain offense utilizing Tsareena to block priority and Tornadus for speed control.",
    paste: `Kyogre @ Mystic Water  
Ability: Drizzle  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Water Spout  
- Origin Pulse  
- Ice Beam  
- Protect  

Tornadus (M) @ Covert Cloak  
Ability: Prankster  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Def / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Bleakwind Storm  
- Tailwind  
- Rain Dance  
- Protect  

Tsareena @ Wide Lens  
Ability: Queenly Majesty  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 252 Atk / 4 SpD  
Adamant Nature  
- Power Whip  
- High Jump Kick  
- U-turn  
- Protect  

Urshifu-Rapid-Strike @ Choice Scarf  
Ability: Unseen Fist  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Surging Strikes  
- Close Combat  
- Aqua Jet  
- U-turn  

Amoonguss @ Rocky Helmet  
Ability: Regenerator  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Def / 4 SpD  
Bold Nature  
IVs: 0 Atk  
- Spore  
- Rage Powder  
- Pollen Puff  
- Protect  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot`
  },
  {
    name: "Terapagos Setup",
    description: "Defensive setup core built around Terapagos's Tera Starstorm and Calm Mind boosts.",
    paste: `Terapagos (M) @ Leftovers  
Ability: Tera Shift  
Level: 50  
Tera Type: Stellar  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Tera Starstorm  
- Earth Power  
- Calm Mind  
- Protect  

Amoonguss @ Rocky Helmet  
Ability: Regenerator  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Def / 4 SpD  
Bold Nature  
IVs: 0 Atk  
- Spore  
- Rage Powder  
- Pollen Puff  
- Protect  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Ogerpon-Wellspring (F) @ Wellspring Mask  
Ability: Water Absorb  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Atk / 4 SpD  
Jolly Nature  
- Ivy Cudgel  
- Horn Leech  
- Spiky Shield  
- Follow Me  

Urshifu-Rapid-Strike @ Choice Scarf  
Ability: Unseen Fist  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Surging Strikes  
- Close Combat  
- Aqua Jet  
- U-turn  

Raging Bolt @ Assault Vest  
Ability: Protosynthesis  
Level: 50  
Tera Type: Electric  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Thunderclap  
- Thunderbolt  
- Draco Meteor  
- Snarl`
  },
  {
    name: "Zamazenta Iron Defense",
    description: "Bulky offense relying on Zamazenta's massive Body Press damage after Iron Defense setup.",
    paste: `Zamazenta @ Rusted Shield  
Ability: Dauntless Shield  
Level: 50  
Tera Type: Grass  
EVs: 252 HP / 252 Def / 4 SpD  
Impish Nature  
- Body Press  
- Heavy Slam  
- Iron Defense  
- Protect  

Pelipper @ Focus Sash  
Ability: Drizzle  
Level: 50  
Tera Type: Ghost  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Hurricane  
- Weather Ball  
- Tailwind  
- Protect  

Amoonguss @ Rocky Helmet  
Ability: Regenerator  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Def / 4 SpD  
Bold Nature  
IVs: 0 Atk  
- Spore  
- Rage Powder  
- Pollen Puff  
- Protect  

Flutter Mane @ Choice Specs  
Ability: Protosynthesis  
Level: 50  
Tera Type: Fairy  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Dazzling Gleam  
- Moonblast  
- Shadow Ball  
- Icy Wind  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Urshifu-Rapid-Strike @ Mystic Water  
Ability: Unseen Fist  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Surging Strikes  
- Close Combat  
- Aqua Jet  
- Protect`
  },
  {
    name: "Miraidon Hadron Engine",
    description: "Electric terrain hyper offense built around Miraidon's Electro Drift and Iron Leaves/Iron Crown.",
    paste: `Miraidon @ Choice Specs  
Ability: Hadron Engine  
Level: 50  
Tera Type: Electric  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Electro Drift  
- Volt Switch  
- Draco Meteor  
- Dazzling Gleam  

Iron Leaves @ Life Orb  
Ability: Quark Drive  
Level: 50  
Tera Type: Grass  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Psyblade  
- Leaf Blade  
- Close Combat  
- Protect  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Ogerpon-Wellspring (F) @ Wellspring Mask  
Ability: Water Absorb  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Atk / 4 SpD  
Jolly Nature  
- Ivy Cudgel  
- Horn Leech  
- Spiky Shield  
- Follow Me  

Urshifu-Rapid-Strike @ Choice Scarf  
Ability: Unseen Fist  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Surging Strikes  
- Close Combat  
- Aqua Jet  
- U-turn  

Iron Crown @ Assault Vest  
Ability: Quark Drive  
Level: 50  
Tera Type: Psychic  
EVs: 252 HP / 252 SpA / 4 SpD  
Modest Nature  
IVs: 0 Atk  
- Tachyon Cutter  
- Expanding Force  
- Focus Blast  
- Volt Switch`
  },
  {
    name: "Koraidon Sun Physical",
    description: "Koraidon-led hyper offense that sets Sun to enable Flutter Mane and Walking Wake while dealing massive physical damage.",
    paste: `Koraidon @ Clear Amulet  
Ability: Orichalcum Pulse  
Level: 50  
Tera Type: Fire  
EVs: 4 HP / 252 Atk / 252 Spe  
Jolly Nature  
- Collision Course  
- Flare Blitz  
- Swords Dance  
- Protect  

Flutter Mane @ Booster Energy  
Ability: Protosynthesis  
Level: 50  
Tera Type: Fairy  
EVs: 252 HP / 252 SpA / 4 Spe  
Modest Nature  
IVs: 0 Atk  
- Dazzling Gleam  
- Moonblast  
- Shadow Ball  
- Protect  

Walking Wake @ Choice Specs  
Ability: Protosynthesis  
Level: 50  
Tera Type: Water  
EVs: 4 HP / 252 SpA / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Hydro Steam  
- Draco Meteor  
- Flamethrower  
- Snarl  

Incineroar @ Sitrus Berry  
Ability: Intimidate  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Atk / 252 SpD  
Careful Nature  
- Flare Blitz  
- Knock Off  
- Fake Out  
- Parting Shot  

Amoonguss @ Rocky Helmet  
Ability: Regenerator  
Level: 50  
Tera Type: Water  
EVs: 252 HP / 252 Def / 4 SpD  
Bold Nature  
IVs: 0 Atk  
- Spore  
- Rage Powder  
- Pollen Puff  
- Protect  

Tornadus (M) @ Covert Cloak  
Ability: Prankster  
Level: 50  
Tera Type: Ghost  
EVs: 252 HP / 4 Def / 252 Spe  
Timid Nature  
IVs: 0 Atk  
- Bleakwind Storm  
- Tailwind  
- Taunt  
- Protect`
  }
];

const outputPath = path.join(__dirname, '..', 'src', 'data', 'meta_teams.json');

fs.writeFileSync(outputPath, JSON.stringify(TEAMS, null, 2));
console.log(`Successfully wrote ${TEAMS.length} teams to ${outputPath}`);
