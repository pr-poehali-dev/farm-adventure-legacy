import { useState, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type PlotState = "empty" | "seeded" | "growing" | "ready";

interface Plot {
  id: number;
  state: PlotState;
  crop: CropType | null;
  growthProgress: number;
  plantedAt: number | null;
}

type CropType = "wheat" | "carrot" | "corn" | "tomato" | "potato";
type AnimalType = "cow" | "chicken" | "sheep" | "pig";
type BuildingId = "barn" | "silo" | "well" | "greenhouse" | "mill";

interface Crop {
  name: string;
  emoji: string;
  seedCost: number;
  sellPrice: number;
  growTime: number;
}

interface Animal {
  id: number;
  type: AnimalType;
  name: string;
  fed: boolean;
  happiness: number;
  lastHarvest: number;
}

interface InventoryItem {
  id: string;
  name: string;
  emoji: string;
  qty: number;
  sellPrice: number;
}

interface Quest {
  id: number;
  title: string;
  desc: string;
  target: number;
  current: number;
  reward: number;
  type: "harvest" | "sell" | "animal" | "build";
  done: boolean;
}

interface Building {
  id: BuildingId;
  name: string;
  emoji: string;
  desc: string;
  cost: number;
  built: boolean;
  level: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CROPS: Record<CropType, Crop> = {
  wheat:   { name: "Пшеница",   emoji: "🌾", seedCost: 10,  sellPrice: 20,  growTime: 30  },
  carrot:  { name: "Морковь",   emoji: "🥕", seedCost: 15,  sellPrice: 35,  growTime: 45  },
  corn:    { name: "Кукуруза",  emoji: "🌽", seedCost: 25,  sellPrice: 60,  growTime: 70  },
  tomato:  { name: "Помидор",   emoji: "🍅", seedCost: 30,  sellPrice: 80,  growTime: 90  },
  potato:  { name: "Картофель", emoji: "🥔", seedCost: 20,  sellPrice: 50,  growTime: 60  },
};

const ANIMAL_INFO: Record<AnimalType, { name: string; emoji: string; cost: number; product: string; productEmoji: string; productValue: number }> = {
  cow:     { name: "Корова",  emoji: "🐄", cost: 200, product: "Молоко",  productEmoji: "🥛", productValue: 40 },
  chicken: { name: "Курица",  emoji: "🐔", cost: 80,  product: "Яйца",    productEmoji: "🥚", productValue: 15 },
  sheep:   { name: "Овца",    emoji: "🐑", cost: 150, product: "Шерсть",  productEmoji: "🧶", productValue: 35 },
  pig:     { name: "Свинья",  emoji: "🐷", cost: 120, product: "Трюфели", productEmoji: "🍄", productValue: 60 },
};

const INITIAL_BUILDINGS: Building[] = [
  { id: "barn",       name: "Амбар",    emoji: "🏚️", desc: "+4 клетки поля",       cost: 300, built: false, level: 1 },
  { id: "silo",       name: "Силос",    emoji: "🗼",  desc: "+50 к инвентарю",      cost: 250, built: false, level: 1 },
  { id: "well",       name: "Колодец",  emoji: "🪣", desc: "Ускоряет рост культур", cost: 400, built: false, level: 1 },
  { id: "greenhouse", name: "Теплица",  emoji: "🏡", desc: "Зимние культуры",       cost: 600, built: false, level: 1 },
  { id: "mill",       name: "Мельница", emoji: "⚙️", desc: "+30% цена продажи",    cost: 500, built: false, level: 1 },
];

const INITIAL_QUESTS: Quest[] = [
  { id: 1, title: "Первый урожай",     desc: "Собери 5 любых культур",      target: 5,   current: 0, reward: 100, type: "harvest", done: false },
  { id: 2, title: "Торговец",          desc: "Продай товаров на 200 монет", target: 200, current: 0, reward: 150, type: "sell",    done: false },
  { id: 3, title: "Животновод",        desc: "Купи 3 животных",             target: 3,   current: 0, reward: 200, type: "animal",  done: false },
  { id: 4, title: "Строитель",         desc: "Построй 2 здания",            target: 2,   current: 0, reward: 300, type: "build",   done: false },
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = "#6abf58" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="pixel-progress w-full">
      <div className="pixel-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function Notification({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-pop-in pixel-border bg-[#0d2008] px-6 py-3 text-[#a0f080] text-xs font-['Press_Start_2P']">
      {text}
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function FieldSection({ coins, setCoins, quests, setQuests, setInventory }: {
  coins: number; setCoins: (c: number) => void;
  quests: Quest[]; setQuests: (q: Quest[]) => void;
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
}) {
  const [plots, setPlots] = useState<Plot[]>(
    Array.from({ length: 12 }, (_, i) => ({ id: i, state: "empty", crop: null, growthProgress: 0, plantedAt: null }))
  );
  const [selectedCrop, setSelectedCrop] = useState<CropType>("wheat");
  const [notif, setNotif] = useState<string | null>(null);
  const [animSet, setAnimSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    const iv = setInterval(() => {
      setPlots(prev => prev.map(p => {
        if (p.state !== "growing" || !p.crop || !p.plantedAt) return p;
        const elapsed = (Date.now() - p.plantedAt) / 1000;
        const progress = Math.min(100, (elapsed / CROPS[p.crop].growTime) * 100);
        return progress >= 100 ? { ...p, state: "ready" as PlotState, growthProgress: 100 } : { ...p, growthProgress: progress };
      }));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const flash = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(null), 2000); };

  const clickPlot = (plot: Plot) => {
    if (plot.state === "empty") {
      if (coins < CROPS[selectedCrop].seedCost) { flash("❌ Недостаточно монет!"); return; }
      setCoins(coins - CROPS[selectedCrop].seedCost);
      setPlots(prev => prev.map(p =>
        p.id === plot.id ? { ...p, state: "growing" as PlotState, crop: selectedCrop, growthProgress: 0, plantedAt: Date.now() } : p
      ));
      setAnimSet(prev => new Set([...prev, plot.id]));
      setTimeout(() => setAnimSet(prev => { const s = new Set(prev); s.delete(plot.id); return s; }), 600);
      flash(`🌱 Посажено: ${CROPS[selectedCrop].name}`);
    } else if (plot.state === "ready" && plot.crop) {
      const crop = CROPS[plot.crop];
      setInventory(prev => {
        const ex = prev.find(i => i.id === plot.crop);
        if (ex) return prev.map(i => i.id === plot.crop ? { ...i, qty: i.qty + 1 } : i);
        return [...prev, { id: plot.crop!, name: crop.name, emoji: crop.emoji, qty: 1, sellPrice: crop.sellPrice }];
      });
      setQuests(quests.map(q => q.type === "harvest" && !q.done ? { ...q, current: Math.min(q.target, q.current + 1) } : q));
      setPlots(prev => prev.map(p =>
        p.id === plot.id ? { id: p.id, state: "empty" as PlotState, crop: null, growthProgress: 0, plantedAt: null } : p
      ));
      flash(`✨ Собрано: ${crop.emoji} ${crop.name}`);
    }
  };

  const plotEmoji = (p: Plot) => {
    if (p.state === "empty") return null;
    if (!p.crop) return "🌱";
    if (p.state === "growing") return p.growthProgress < 40 ? "🌱" : p.growthProgress < 80 ? "🌿" : CROPS[p.crop].emoji;
    if (p.state === "ready") return CROPS[p.crop].emoji;
    return null;
  };

  return (
    <div className="space-y-4">
      <Notification text={notif} />
      <div className="pixel-border bg-[#0d2008] p-4">
        <div className="text-[#6abf58] text-[8px] mb-3 uppercase tracking-widest">Выбор культуры</div>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(CROPS) as [CropType, Crop][]).map(([key, crop]) => (
            <button key={key} onClick={() => setSelectedCrop(key)}
              className={`pixel-btn ${selectedCrop === key ? "pixel-btn-gold" : "pixel-btn-brown"} flex items-center gap-2`}>
              <span>{crop.emoji}</span>
              <span className="hidden sm:inline">{crop.name}</span>
              <span className="text-[7px] opacity-70">💰{crop.seedCost}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[7px] text-[#8aaa80]">
          <span>Выбрано: <span className="text-[#FFD700]">{CROPS[selectedCrop].emoji} {CROPS[selectedCrop].name}</span></span>
          <span>Семена: <span className="text-[#FFD700]">💰{CROPS[selectedCrop].seedCost}</span></span>
          <span>Продажа: <span className="text-[#6abf58]">💰{CROPS[selectedCrop].sellPrice}</span></span>
          <span>Время: <span className="text-[#c0d0ff]">⏱{CROPS[selectedCrop].growTime}с</span></span>
        </div>
      </div>

      <div className="pixel-border bg-[#0d2008] p-4">
        <div className="text-[#6abf58] text-[8px] mb-4 uppercase tracking-widest">Поле — нажми на клетку</div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
          {plots.map(plot => {
            const emoji = plotEmoji(plot);
            return (
              <div key={plot.id} onClick={() => clickPlot(plot)}
                className={`field-cell soil-cell relative ${animSet.has(plot.id) ? "animate-grow" : ""}`}
                style={{
                  border: plot.state === "ready" ? "3px solid #FFD700"
                    : plot.state === "growing" ? "3px solid #4a7c40"
                    : "3px solid #3a2a14",
                  boxShadow: plot.state === "ready" ? "0 0 8px #FFD70066" : "none",
                }}>
                {emoji ? <span className="text-2xl">{emoji}</span> : <span className="text-[#5c3d1e] text-xs opacity-40">+</span>}
                {plot.state === "growing" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1a1a1a]">
                    <div className="h-full bg-[#6abf58]" style={{ width: `${plot.growthProgress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-[6px] text-[#6a8a62]">🟫 Пусто = клик для посадки &nbsp;|&nbsp; 🌿 Растёт &nbsp;|&nbsp; ✨ Золото = готово к сбору</div>
      </div>
    </div>
  );
}

function AnimalSection({ coins, setCoins, quests, setQuests, setInventory }: {
  coins: number; setCoins: (c: number) => void;
  quests: Quest[]; setQuests: (q: Quest[]) => void;
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
}) {
  const [animals, setAnimals] = useState<Animal[]>([
    { id: 1, type: "chicken", name: "Кеша", fed: false, happiness: 60, lastHarvest: Date.now() - 20000 },
  ]);
  const [notif, setNotif] = useState<string | null>(null);
  const flash = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(null), 2000); };

  const buy = (type: AnimalType) => {
    const info = ANIMAL_INFO[type];
    if (coins < info.cost) { flash("❌ Недостаточно монет!"); return; }
    setCoins(coins - info.cost);
    setAnimals(prev => [...prev, { id: Date.now(), type, name: `${info.name} #${prev.length + 1}`, fed: false, happiness: 80, lastHarvest: Date.now() }]);
    setQuests(quests.map(q => q.type === "animal" && !q.done ? { ...q, current: Math.min(q.target, q.current + 1) } : q));
    flash(`🎉 Куплено: ${info.emoji} ${info.name}`);
  };

  const feed = (id: number) => {
    setAnimals(prev => prev.map(a => a.id === id ? { ...a, fed: true, happiness: Math.min(100, a.happiness + 20) } : a));
    flash("🌾 Животное накормлено!");
  };

  const harvest = (animal: Animal) => {
    const info = ANIMAL_INFO[animal.type];
    const since = (Date.now() - animal.lastHarvest) / 1000;
    if (since < 15) { flash(`⏳ Ещё не готово! (${Math.ceil(15 - since)}с)`); return; }
    setInventory(prev => {
      const key = `${animal.type}_product`;
      const ex = prev.find(i => i.id === key);
      if (ex) return prev.map(i => i.id === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: key, name: info.product, emoji: info.productEmoji, qty: 1, sellPrice: info.productValue }];
    });
    setAnimals(prev => prev.map(a => a.id === animal.id ? { ...a, lastHarvest: Date.now(), fed: false } : a));
    flash(`✨ Собрано: ${info.productEmoji} ${info.product}`);
  };

  return (
    <div className="space-y-4">
      <Notification text={notif} />
      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="text-[#6abf58] text-[8px] mb-3 uppercase tracking-widest">Купить животных</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(ANIMAL_INFO) as [AnimalType, typeof ANIMAL_INFO[AnimalType]][]).map(([key, info]) => (
            <div key={key} className="pixel-border-brown bg-[#0a1208] p-3 text-center space-y-2">
              <div className="text-4xl animate-float">{info.emoji}</div>
              <div className="text-[8px] text-[#c8f0a0]">{info.name}</div>
              <div className="text-[6px] text-[#8aaa80]">Даёт: {info.productEmoji} {info.product}</div>
              <div className="text-[7px] text-[#FFD700]">💰 {info.cost}</div>
              <button onClick={() => buy(key)} className="pixel-btn pixel-btn-green w-full">Купить</button>
            </div>
          ))}
        </div>
      </div>

      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="text-[#6abf58] text-[8px] mb-3 uppercase tracking-widest">Мои животные ({animals.length})</div>
        {animals.length === 0 ? (
          <div className="text-center py-8 text-[#3a5a32] text-[8px]">У тебя пока нет животных</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {animals.map(animal => {
              const info = ANIMAL_INFO[animal.type];
              const canHarvest = (Date.now() - animal.lastHarvest) / 1000 >= 15;
              return (
                <div key={animal.id} className="pixel-border-brown bg-[#0a1208] p-4 animal-card">
                  <div className="flex items-start gap-3">
                    <div className="text-5xl animate-float">{info.emoji}</div>
                    <div className="flex-1 space-y-2">
                      <div className="text-[9px] text-[#c8f0a0]">{animal.name}</div>
                      <div className="text-[7px] text-[#8aaa80]">
                        Счастье: <span className="text-[#FFD700]">{animal.happiness}%</span>
                        {animal.fed && <span className="ml-2 text-[#6abf58]">✓ Сыт</span>}
                      </div>
                      <ProgressBar value={animal.happiness} max={100} color="#FFD700" />
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => feed(animal.id)} disabled={animal.fed}
                          className={`pixel-btn text-[7px] px-2 py-1 ${animal.fed ? "opacity-40 cursor-not-allowed pixel-btn-brown" : "pixel-btn-green"}`}>
                          🌾 Кормить
                        </button>
                        <button onClick={() => harvest(animal)} disabled={!canHarvest}
                          className={`pixel-btn text-[7px] px-2 py-1 ${canHarvest ? "pixel-btn-gold" : "opacity-40 cursor-not-allowed pixel-btn-brown"}`}>
                          {info.productEmoji} Собрать
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ShopSection({ coins, setCoins, inventory, setInventory, quests, setQuests }: {
  coins: number; setCoins: (c: number) => void;
  inventory: InventoryItem[]; setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  quests: Quest[]; setQuests: (q: Quest[]) => void;
}) {
  const [notif, setNotif] = useState<string | null>(null);
  const [soldTotal, setSoldTotal] = useState(0);
  const flash = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(null), 2000); };

  const sell = (item: InventoryItem, qty: number) => {
    if (item.qty < qty) { flash("❌ Недостаточно!"); return; }
    const total = item.sellPrice * qty;
    setCoins(coins + total);
    setSoldTotal(p => p + total);
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty - qty } : i).filter(i => i.qty > 0));
    setQuests(quests.map(q => q.type === "sell" && !q.done ? { ...q, current: Math.min(q.target, q.current + total) } : q));
    flash(`💰 Продано за ${total} монет!`);
  };

  return (
    <div className="space-y-4">
      <Notification text={notif} />
      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-[#6abf58] text-[8px] uppercase tracking-widest">Рынок — Продажа</div>
          <div className="text-[8px] text-[#FFD700]">Выручка: 💰 {soldTotal}</div>
        </div>
        {inventory.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">🏪</div>
            <div className="text-[8px] text-[#3a5a32]">Инвентарь пуст</div>
            <div className="text-[7px] text-[#2a4a22]">Вырасти или собери продукты сначала</div>
          </div>
        ) : (
          <div className="space-y-2">
            {inventory.map(item => (
              <div key={item.id} className="pixel-border-brown bg-[#0a1208] p-3 flex items-center gap-4">
                <span className="text-3xl">{item.emoji}</span>
                <div className="flex-1">
                  <div className="text-[9px] text-[#c8f0a0]">{item.name}</div>
                  <div className="text-[7px] text-[#8aaa80]">
                    Кол-во: <span className="text-[#FFD700]">{item.qty}</span> &nbsp;|&nbsp; Цена: <span className="text-[#6abf58]">💰{item.sellPrice}</span>/шт
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => sell(item, 1)} className="pixel-btn pixel-btn-green text-[7px] px-2 py-1">×1</button>
                  <button onClick={() => sell(item, item.qty)} className="pixel-btn pixel-btn-gold text-[7px] px-2 py-1">
                    Всё 💰{item.qty * item.sellPrice}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="text-[#6abf58] text-[8px] mb-3 uppercase tracking-widest">Цены рынка</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(Object.values(CROPS) as Crop[]).map(crop => (
            <div key={crop.name} className="bg-[#0a1208] border border-[#2a4020] p-2 flex items-center gap-2">
              <span className="text-xl">{crop.emoji}</span>
              <div>
                <div className="text-[6px] text-[#c8f0a0]">{crop.name}</div>
                <div className="text-[7px] text-[#FFD700]">💰 {crop.sellPrice}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuildSection({ coins, setCoins, quests, setQuests }: {
  coins: number; setCoins: (c: number) => void;
  quests: Quest[]; setQuests: (q: Quest[]) => void;
}) {
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_BUILDINGS);
  const [notif, setNotif] = useState<string | null>(null);
  const flash = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(null), 2000); };

  const build = (b: Building) => {
    if (coins < b.cost) { flash("❌ Недостаточно монет!"); return; }
    setCoins(coins - b.cost);
    setBuildings(prev => prev.map(x => x.id === b.id ? { ...x, built: true } : x));
    const cnt = buildings.filter(x => x.built).length + 1;
    setQuests(quests.map(q => q.type === "build" && !q.done ? { ...q, current: Math.min(q.target, cnt) } : q));
    flash(`🎉 Построено: ${b.emoji} ${b.name}!`);
  };

  const upgrade = (b: Building) => {
    const cost = b.cost * b.level;
    if (coins < cost) { flash("❌ Недостаточно монет!"); return; }
    setCoins(coins - cost);
    setBuildings(prev => prev.map(x => x.id === b.id ? { ...x, level: x.level + 1 } : x));
    flash(`⬆️ Улучшено до уровня ${b.level + 1}!`);
  };

  return (
    <div className="space-y-4">
      <Notification text={notif} />
      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="text-[#6abf58] text-[8px] mb-4 uppercase tracking-widest">Строительство и улучшения</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {buildings.map(b => (
            <div key={b.id} className={`p-4 space-y-3 ${b.built ? "pixel-border bg-[#0a1a08]" : "pixel-border-brown bg-[#0a0e08]"}`}>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{b.emoji}</span>
                <div>
                  <div className="text-[9px] text-[#c8f0a0] flex items-center gap-2">
                    {b.name}
                    {b.built && <span className="text-[6px] text-[#6abf58] bg-[#1a3a10] px-1">Lv.{b.level}</span>}
                  </div>
                  <div className="text-[7px] text-[#8aaa80] mt-1">{b.desc}</div>
                </div>
              </div>
              {!b.built ? (
                <button onClick={() => build(b)} className="pixel-btn pixel-btn-green w-full">Построить 💰{b.cost}</button>
              ) : (
                <div className="space-y-2">
                  <div className="text-[7px] text-[#6abf58]">✅ Построено</div>
                  <button onClick={() => upgrade(b)} className="pixel-btn pixel-btn-gold w-full">
                    ⬆️ Улучшить Lv.{b.level + 1} — 💰{b.cost * b.level}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InventorySection({ inventory }: { inventory: InventoryItem[] }) {
  const total = inventory.reduce((s, i) => s + i.qty, 0);
  const value = inventory.reduce((s, i) => s + i.qty * i.sellPrice, 0);
  return (
    <div className="space-y-4">
      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[#6abf58] text-[8px] uppercase tracking-widest">Инвентарь</div>
          <div className="text-[7px] text-[#8aaa80]">{total}/100 &nbsp;|&nbsp; 💰{value}</div>
        </div>
        <ProgressBar value={total} max={100} />
        {inventory.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🎒</div>
            <div className="text-[8px] text-[#3a5a32]">Рюкзак пуст</div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {inventory.map(item => (
              <div key={item.id} className="pixel-border-brown bg-[#0a1208] p-3 text-center space-y-1">
                <div className="text-3xl">{item.emoji}</div>
                <div className="text-[7px] text-[#c8f0a0]">{item.name}</div>
                <div className="text-[10px] font-bold text-[#FFD700]">×{item.qty}</div>
                <div className="text-[6px] text-[#8aaa80]">💰{item.sellPrice}/шт</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="text-[#6abf58] text-[8px] mb-3 uppercase tracking-widest">Ресурсы фермы</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { e: "🪵", n: "Дерево", q: 24 },
            { e: "🪨", n: "Камень", q: 16 },
            { e: "💧", n: "Вода",   q: 50 },
            { e: "⚙️", n: "Железо", q: 8  },
            { e: "🧲", n: "Магнит", q: 3  },
            { e: "🌿", n: "Трава",  q: 40 },
          ].map(r => (
            <div key={r.n} className="bg-[#0a1208] border border-[#2a4020] p-2 flex flex-col items-center gap-1">
              <span className="text-xl">{r.e}</span>
              <div className="text-[6px] text-[#8aaa80]">{r.n}</div>
              <div className="text-[9px] text-[#c8f0a0]">{r.q}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestsSection({ quests, setQuests, coins, setCoins }: {
  quests: Quest[]; setQuests: (q: Quest[]) => void;
  coins: number; setCoins: (c: number) => void;
}) {
  const [notif, setNotif] = useState<string | null>(null);
  const flash = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(null), 2500); };
  const typeIcon: Record<Quest["type"], string> = { harvest: "🌾", sell: "🏪", animal: "🐄", build: "🏗️" };

  const claim = (q: Quest) => {
    if (q.current < q.target || q.done) return;
    setCoins(coins + q.reward);
    setQuests(quests.map(x => x.id === q.id ? { ...x, done: true } : x));
    flash(`🎉 Получена награда: 💰${q.reward} монет!`);
  };

  return (
    <div className="space-y-3">
      <Notification text={notif} />
      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="text-[#6abf58] text-[8px] mb-4 uppercase tracking-widest">Задания и цели</div>
        <div className="space-y-3">
          {quests.map(q => {
            const canClaim = q.current >= q.target && !q.done;
            return (
              <div key={q.id} className={`p-4 ${q.done ? "bg-[#0a1a08] border border-[#2a5a20]" : "pixel-border-brown bg-[#0d1005]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeIcon[q.type]}</span>
                      <span className="text-[8px] text-[#c8f0a0]">{q.title}</span>
                      {q.done && <span className="text-[6px] text-[#6abf58] bg-[#1a3a10] px-1">✓ Выполнено</span>}
                    </div>
                    <div className="text-[7px] text-[#8aaa80]">{q.desc}</div>
                    <div className="flex items-center gap-3">
                      <ProgressBar value={q.current} max={q.target} color={q.done ? "#6abf58" : "#FFD700"} />
                      <span className="text-[7px] text-[#FFD700] whitespace-nowrap">{q.current}/{q.target}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[7px] text-[#FFD700] mb-2">💰 {q.reward}</div>
                    {canClaim && (
                      <button onClick={() => claim(q)} className="pixel-btn pixel-btn-gold text-[7px] animate-shake">
                        Забрать!
                      </button>
                    )}
                    {q.done && <div className="text-[#6abf58] text-xl">✅</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Village Section ──────────────────────────────────────────────────────────

type HouseLevel = 0 | 1 | 2 | 3 | 4;

const HOUSE_STAGES: { label: string; emoji: string; color: string; desc: string; repairCost: number }[] = [
  { label: "Руины",        emoji: "🏚️", color: "#5a3a1a", desc: "Полуразрушенные стены, нет крыши",      repairCost: 200  },
  { label: "Лачуга",       emoji: "🛖",  color: "#7a5a2a", desc: "Починены стены, дыры в крыше",           repairCost: 400  },
  { label: "Хижина",       emoji: "🏠",  color: "#8a6a3a", desc: "Жилой дом, нужна покраска",              repairCost: 600  },
  { label: "Добротный дом",emoji: "🏡",  color: "#6a8a40", desc: "Крепкий дом с садом",                    repairCost: 900  },
  { label: "Усадьба",      emoji: "🏰",  color: "#5a9a50", desc: "Шикарная усадьба! Ремонт завершён",      repairCost: 0    },
];

interface BerryBush {
  id: number;
  type: "strawberry" | "blueberry" | "raspberry";
  ready: boolean;
  lastPick: number;
}

interface TreeObj {
  id: number;
  type: "oak" | "pine" | "birch" | "apple";
  hasFruit: boolean;
  lastPick: number;
}

const BERRY_INFO = {
  strawberry: { name: "Клубника",  emoji: "🍓", value: 25, readyIn: 20 },
  blueberry:  { name: "Черника",   emoji: "🫐", value: 30, readyIn: 30 },
  raspberry:  { name: "Малина",    emoji: "🍇", value: 20, readyIn: 15 },
};

const TREE_INFO = {
  oak:    { name: "Дуб",    emoji: "🌳", fruitEmoji: null,  fruitName: null,   value: 0  },
  pine:   { name: "Сосна",  emoji: "🌲", fruitEmoji: null,  fruitName: null,   value: 0  },
  birch:  { name: "Берёза", emoji: "🌳", fruitEmoji: null,  fruitName: null,   value: 0  },
  apple:  { name: "Яблоня", emoji: "🌳", fruitEmoji: "🍎",  fruitName: "Яблоко", value: 35 },
};

const GRASS_PATCHES = ["🌿","🌿","🍀","🌾","🌿","🌱","🍀","🌿","🌾","🌱","🌿","🍀"];

function VillageSection({ coins, setCoins, setInventory }: {
  coins: number; setCoins: (c: number) => void;
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
}) {
  const [houseLevel, setHouseLevel] = useState<HouseLevel>(0);
  const [repairing, setRepairing] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [bushes, setBushes] = useState<BerryBush[]>([
    { id: 1, type: "strawberry", ready: true,  lastPick: Date.now() - 25000 },
    { id: 2, type: "blueberry",  ready: false, lastPick: Date.now() - 5000  },
    { id: 3, type: "raspberry",  ready: true,  lastPick: Date.now() - 20000 },
    { id: 4, type: "strawberry", ready: false, lastPick: Date.now() - 8000  },
    { id: 5, type: "blueberry",  ready: false, lastPick: Date.now() - 10000 },
  ]);

  const [trees, setTrees] = useState<TreeObj[]>([
    { id: 1, type: "oak",   hasFruit: false, lastPick: Date.now() },
    { id: 2, type: "pine",  hasFruit: false, lastPick: Date.now() },
    { id: 3, type: "apple", hasFruit: true,  lastPick: Date.now() - 40000 },
    { id: 4, type: "birch", hasFruit: false, lastPick: Date.now() },
    { id: 5, type: "apple", hasFruit: false, lastPick: Date.now() - 10000 },
    { id: 6, type: "oak",   hasFruit: false, lastPick: Date.now() },
  ]);

  // Tick for ripening
  useEffect(() => {
    const iv = setInterval(() => {
      setTick(t => t + 1);
      setBushes(prev => prev.map(b => {
        if (b.ready) return b;
        const since = (Date.now() - b.lastPick) / 1000;
        return since >= BERRY_INFO[b.type].readyIn ? { ...b, ready: true } : b;
      }));
      setTrees(prev => prev.map(t => {
        if (t.type !== "apple" || t.hasFruit) return t;
        const since = (Date.now() - t.lastPick) / 1000;
        return since >= 40 ? { ...t, hasFruit: true } : t;
      }));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const flash = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(null), 2000); };

  const repair = () => {
    if (houseLevel >= 4) return;
    const stage = HOUSE_STAGES[houseLevel];
    if (coins < stage.repairCost) { flash("❌ Недостаточно монет!"); return; }
    setRepairing(true);
    setCoins(coins - stage.repairCost);
    setTimeout(() => {
      setHouseLevel(prev => (prev + 1) as HouseLevel);
      setRepairing(false);
      flash(`🎉 Дом улучшен! Теперь: ${HOUSE_STAGES[houseLevel + 1].label}`);
    }, 1200);
  };

  const pickBerry = (bush: BerryBush) => {
    if (!bush.ready) {
      const since = (Date.now() - bush.lastPick) / 1000;
      const left = Math.ceil(BERRY_INFO[bush.type].readyIn - since);
      flash(`⏳ Ещё не поспело! (${left}с)`);
      return;
    }
    const info = BERRY_INFO[bush.type];
    setInventory(prev => {
      const ex = prev.find(i => i.id === bush.type);
      if (ex) return prev.map(i => i.id === bush.type ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: bush.type, name: info.name, emoji: info.emoji, qty: 1, sellPrice: info.value }];
    });
    setBushes(prev => prev.map(b => b.id === bush.id ? { ...b, ready: false, lastPick: Date.now() } : b));
    flash(`${info.emoji} Собрано: ${info.name}!`);
  };

  const pickApple = (tree: TreeObj) => {
    if (!tree.hasFruit) { flash("🍎 Яблоки ещё не созрели!"); return; }
    setInventory(prev => {
      const ex = prev.find(i => i.id === "apple");
      if (ex) return prev.map(i => i.id === "apple" ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: "apple", name: "Яблоко", emoji: "🍎", qty: 1, sellPrice: 35 }];
    });
    setTrees(prev => prev.map(t => t.id === tree.id ? { ...t, hasFruit: false, lastPick: Date.now() } : t));
    flash("🍎 Яблоко сорвано!");
  };

  const currentStage = HOUSE_STAGES[houseLevel];
  const nextStage = houseLevel < 4 ? HOUSE_STAGES[houseLevel + 1] : null;
  const repairProgress = houseLevel / 4 * 100;

  return (
    <div className="space-y-4">
      <Notification text={notif} />

      {/* Village scene */}
      <div className="pixel-border bg-[#0d2008] p-0 overflow-hidden relative" style={{ minHeight: 220 }}>
        {/* Sky strip */}
        <div className="h-12 bg-gradient-to-b from-[#1a3a3a] to-[#1a3a18] relative overflow-hidden">
          {/* Clouds */}
          <div className="absolute top-2 left-[10%] text-2xl opacity-60" style={{ animation: "cloud-drift 18s linear infinite" }}>☁️</div>
          <div className="absolute top-3 left-[50%] text-xl opacity-40" style={{ animation: "cloud-drift 25s linear infinite 8s" }}>☁️</div>
          <div className="absolute top-1 left-[80%] text-lg opacity-50" style={{ animation: "cloud-drift 20s linear infinite 3s" }}>☁️</div>
          {/* Sun/Moon based on tick parity */}
          <div className="absolute top-2 right-6 text-2xl">🌤️</div>
        </div>

        {/* Ground scene */}
        <div className="relative bg-[#1a3a10] px-4 pb-4 pt-2">
          {/* Grass patches */}
          <div className="flex flex-wrap gap-1 mb-3 opacity-60">
            {GRASS_PATCHES.map((g, i) => (
              <span key={i} className="text-base" style={{ animationDelay: `${i * 0.3}s`, animation: "sway 3s ease-in-out infinite" }}>{g}</span>
            ))}
          </div>

          {/* Main scene row */}
          <div className="flex items-end gap-4 flex-wrap">
            {/* House */}
            <div
              className="relative cursor-pointer group"
              onClick={repair}
              title={houseLevel < 4 ? `Починить — 💰${currentStage.repairCost}` : "Дом отремонтирован!"}
            >
              <div className={`text-7xl transition-all duration-500 ${repairing ? "animate-shake" : "group-hover:scale-110"}`}
                style={{ filter: houseLevel < 2 ? "grayscale(0.7) sepia(0.3)" : houseLevel < 4 ? "none" : "drop-shadow(0 0 8px #FFD70088)" }}>
                {currentStage.emoji}
              </div>
              {/* Repair badge */}
              {houseLevel < 4 && !repairing && (
                <div className="absolute -top-2 -right-2 bg-[#FFD700] text-[#1a0a00] text-[6px] font-['Press_Start_2P'] px-1 py-0.5 border border-[#a07800] animate-pulse">
                  💰{currentStage.repairCost}
                </div>
              )}
              {repairing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl animate-spin">⚙️</span>
                </div>
              )}
              {houseLevel >= 4 && (
                <div className="absolute -top-2 -right-2 text-lg">⭐</div>
              )}
            </div>

            {/* Trees */}
            {trees.map(tree => {
              const info = TREE_INFO[tree.type];
              return (
                <div key={tree.id}
                  className={`relative text-4xl cursor-pointer transition-transform hover:scale-110 ${tree.type === "apple" ? "hover:brightness-110" : ""}`}
                  onClick={() => tree.type === "apple" ? pickApple(tree) : undefined}
                  style={{ animation: `sway ${2.5 + tree.id * 0.4}s ease-in-out infinite` }}
                  title={tree.type === "apple" ? (tree.hasFruit ? "🍎 Сорвать яблоко!" : "🍎 Яблоки ещё растут...") : info.name}
                >
                  {info.emoji}
                  {tree.type === "apple" && tree.hasFruit && (
                    <span className="absolute -bottom-1 right-0 text-sm animate-float">🍎</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Berry bushes row */}
          <div className="flex gap-3 mt-3 flex-wrap">
            {bushes.map(bush => {
              const info = BERRY_INFO[bush.type];
              return (
                <div key={bush.id}
                  className={`relative cursor-pointer transition-transform hover:scale-110 flex flex-col items-center`}
                  onClick={() => pickBerry(bush)}
                  title={bush.ready ? `${info.emoji} Собрать ${info.name}!` : "Ещё не поспело..."}
                >
                  <div className={`text-2xl transition-all ${bush.ready ? "" : "grayscale opacity-60"}`}>🌿</div>
                  {bush.ready && (
                    <div className="absolute -top-1 text-base animate-float">{info.emoji}</div>
                  )}
                  {!bush.ready && (
                    <div className="absolute -top-1 text-xs opacity-40">🌱</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* House status card */}
      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{currentStage.emoji}</span>
            <div className="space-y-1">
              <div className="text-[10px] text-[#c8f0a0] font-['Press_Start_2P']">{currentStage.label}</div>
              <div className="text-[7px] text-[#8aaa80]">{currentStage.desc}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="text-[6px] text-[#6a8a62] uppercase">Состояние</div>
                <div className="w-32">
                  <ProgressBar value={houseLevel} max={4} color={houseLevel >= 4 ? "#FFD700" : "#6abf58"} />
                </div>
                <div className="text-[7px] text-[#FFD700]">{houseLevel}/4</div>
              </div>
            </div>
          </div>
          {houseLevel < 4 ? (
            <div className="space-y-2 text-right">
              <div className="text-[7px] text-[#8aaa80]">
                Следующий уровень: <span className="text-[#c8f0a0]">{HOUSE_STAGES[houseLevel + 1]?.label}</span>
              </div>
              <button
                onClick={repair}
                disabled={repairing || coins < currentStage.repairCost}
                className={`pixel-btn ${coins >= currentStage.repairCost && !repairing ? "pixel-btn-gold" : "pixel-btn-brown opacity-50"}`}
              >
                {repairing ? "⚙️ Ремонт..." : `🔨 Починить — 💰${currentStage.repairCost}`}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <div className="text-3xl">⭐</div>
              <div className="text-[7px] text-[#FFD700]">Идеальное состояние!</div>
            </div>
          )}
        </div>
      </div>

      {/* Repair stages road */}
      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="text-[#6abf58] text-[8px] mb-3 uppercase tracking-widest">Этапы ремонта</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {HOUSE_STAGES.map((stage, i) => (
            <div key={i} className={`flex-shrink-0 text-center p-3 border-2 min-w-[90px] ${
              i < houseLevel ? "border-[#6abf58] bg-[#0a1a08]" :
              i === houseLevel ? "border-[#FFD700] bg-[#1a1000]" :
              "border-[#2a3a22] bg-[#0a0e08] opacity-60"
            }`}>
              <div className={`text-2xl mb-1 ${i < houseLevel ? "" : i === houseLevel ? "animate-float" : "grayscale"}`}>{stage.emoji}</div>
              <div className="text-[6px] text-[#c8f0a0]">{stage.label}</div>
              {i < 4 && <div className="text-[5px] text-[#FFD700] mt-1">💰{stage.repairCost}</div>}
              {i < houseLevel && <div className="text-[#6abf58] text-xs mt-1">✓</div>}
              {i === houseLevel && houseLevel < 4 && <div className="text-[#FFD700] text-[5px] mt-1">← текущий</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Bushes & gather info */}
      <div className="pixel-border bg-[#0d1a0a] p-4">
        <div className="text-[#6abf58] text-[8px] mb-3 uppercase tracking-widest">Ягодные кусты</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {bushes.map(bush => {
            const info = BERRY_INFO[bush.type];
            const since = (Date.now() - bush.lastPick) / 1000;
            const progress = bush.ready ? 100 : Math.min(100, (since / info.readyIn) * 100);
            return (
              <div key={bush.id}
                className={`pixel-border-brown bg-[#0a1208] p-3 text-center space-y-1 cursor-pointer transition-transform hover:scale-105 ${bush.ready ? "border-[#6abf58]" : ""}`}
                onClick={() => pickBerry(bush)}
              >
                <div className={`text-2xl ${bush.ready ? "animate-float" : "opacity-50"}`}>{bush.ready ? info.emoji : "🌿"}</div>
                <div className="text-[6px] text-[#c8f0a0]">{info.name}</div>
                <ProgressBar value={progress} max={100} color={bush.ready ? "#6abf58" : "#4a6a40"} />
                <div className="text-[5px] text-[#FFD700]">💰{info.value}/шт</div>
                {bush.ready && <div className="text-[5px] text-[#6abf58]">Готово!</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = "field" | "animals" | "shop" | "build" | "inventory" | "quests" | "village";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "village",   label: "Деревня", emoji: "🏡" },
  { id: "field",     label: "Поле",    emoji: "🌾" },
  { id: "animals",   label: "Загон",   emoji: "🐄" },
  { id: "shop",      label: "Магазин", emoji: "🏪" },
  { id: "build",     label: "Стройка", emoji: "🏗️" },
  { id: "inventory", label: "Рюкзак",  emoji: "🎒" },
  { id: "quests",    label: "Задания", emoji: "📜" },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("village");
  const [coins, setCoins] = useState(500);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [day, setDay] = useState(1);

  useEffect(() => {
    const iv = setInterval(() => setDay(d => d + 1), 120_000);
    return () => clearInterval(iv);
  }, []);

  const invCount = inventory.reduce((s, i) => s + i.qty, 0);
  const pendingReward = quests.some(q => q.current >= q.target && !q.done);
  const doneCount = quests.filter(q => q.done).length;

  return (
    <div className="scanlines min-h-screen grass-bg">
      {/* Header */}
      <header className="bg-[#0a1a08] border-b-4 border-[#2a5a20]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-float">🚜</span>
            <div>
              <div className="font-['Press_Start_2P'] text-[#6abf58] text-sm leading-none">ПиксельФерма</div>
              <div className="font-['Press_Start_2P'] text-[#3a7030] text-[6px] mt-1">День {day} &nbsp;|&nbsp; {doneCount}/{quests.length} заданий</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="font-['Press_Start_2P'] text-[7px] text-[#6abf58] bg-[#0d2008] px-3 py-2 border-2 border-[#2a5a20]">
              🎒 {invCount}
            </div>
            <div className="flex items-center gap-2 pixel-border-gold px-4 py-2 bg-[#1a1000]">
              <span className="text-xl">💰</span>
              <span className="font-['Press_Start_2P'] text-[#FFD700] text-sm">{coins.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-[#0c1a0a] border-b-2 border-[#1a4014] overflow-x-auto">
        <div className="max-w-5xl mx-auto flex">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`pixel-tab flex items-center gap-1.5 relative ${activeTab === tab.id ? "active" : ""}`}>
              <span>{tab.emoji}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === "quests" && pendingReward && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FFD700] border border-[#a07800] animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === "village" && <VillageSection coins={coins} setCoins={setCoins} setInventory={setInventory} />}
        {activeTab === "field" && <FieldSection coins={coins} setCoins={setCoins} quests={quests} setQuests={setQuests} setInventory={setInventory} />}
        {activeTab === "animals" && <AnimalSection coins={coins} setCoins={setCoins} quests={quests} setQuests={setQuests} setInventory={setInventory} />}
        {activeTab === "shop" && <ShopSection coins={coins} setCoins={setCoins} inventory={inventory} setInventory={setInventory} quests={quests} setQuests={setQuests} />}
        {activeTab === "build" && <BuildSection coins={coins} setCoins={setCoins} quests={quests} setQuests={setQuests} />}
        {activeTab === "inventory" && <InventorySection inventory={inventory} />}
        {activeTab === "quests" && <QuestsSection quests={quests} setQuests={setQuests} coins={coins} setCoins={setCoins} />}
      </main>

      <footer className="text-center py-4 font-['Press_Start_2P'] text-[6px] text-[#2a4a22] border-t-2 border-[#1a3a14]">
        PixelFarm v0.1 &nbsp;|&nbsp; © 2026
      </footer>
    </div>
  );
}