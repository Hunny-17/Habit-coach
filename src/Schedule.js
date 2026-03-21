import { useState, useEffect, useRef } from "react";
import supabase from "./supabase";
import { Html5Qrcode } from "html5-qrcode";

function Schedule({ onBack }) {
  const [tab, setTab] = useState("nutrition");
  const [nutritionLog, setNutritionLog] = useState([]);
  const [workoutLog, setWorkoutLog] = useState([]);
  const [habits, setHabits] = useState([]);
  const [checkins, setCheckins] = useState({});
  const [streaks, setStreaks] = useState({});
  const [newHabit, setNewHabit] = useState("");
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const scannerRef = useRef(null);
  const imgInputRef = useRef(null);

  const dateStr = selectedDate.toISOString().split("T")[0];
  const displayDate = selectedDate.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

  useEffect(() => { fetchAll(); }, [dateStr]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: n }, { data: w }, { data: h }, { data: c }] = await Promise.all([
      supabase.from("nutrition").select("*").eq("date", dateStr).order("created_at"),
      supabase.from("workouts").select("*").eq("date", dateStr).order("created_at"),
      supabase.from("habits").select("*").order("created_at"),
      supabase.from("checkins").select("*").eq("date", dateStr),
    ]);
    setNutritionLog(n || []);
    setWorkoutLog(w || []);
    setHabits(h || []);
    const checkinMap = {};
    (c || []).forEach(ci => { checkinMap[ci.habit_id] = ci; });
    setCheckins(checkinMap);
    if (h?.length) await calcStreaks(h);
    setLoading(false);
  }

  async function calcStreaks(habitList) {
    const streakMap = {};
    for (const habit of habitList) {
      const { data: logs } = await supabase
        .from("checkins").select("date, done")
        .eq("habit_id", habit.id).eq("done", true)
        .order("date", { ascending: false });
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < (logs?.length || 0); i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const expectedStr = expected.toISOString().split("T")[0];
        if (logs[i].date === expectedStr) streak++;
        else break;
      }
      streakMap[habit.id] = streak;
    }
    setStreaks(streakMap);
  }

  function prevDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  }

  function nextDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  }

  function isToday() {
    return dateStr === new Date().toISOString().split("T")[0];
  }

  async function addHabit() {
    if (!newHabit.trim()) return;
    const { error } = await supabase.from("habits").insert({ name: newHabit, user_id: null });
    if (!error) { setNewHabit(""); fetchAll(); }
  }

  async function deleteHabit(id) {
    await supabase.from("checkins").delete().eq("habit_id", id);
    await supabase.from("habits").delete().eq("id", id);
    fetchAll();
  }

async function saveCheckin(habitId, done) {
  await supabase.from("checkins").upsert(
    { habit_id: habitId, user_id: null, done, skip_reason: done ? null : "Quên", date: dateStr },
    { onConflict: "habit_id,date" }
  );
  fetchAll();
}

  async function addNutrition() {
    if (!form.name) return;
    const { error } = await supabase.from("nutrition").insert({
      name: form.name,
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
      date: dateStr,
    });
    if (!error) { setForm({}); fetchAll(); }
  }

  async function addWorkout() {
    if (!form.name) return;
    const { error } = await supabase.from("workouts").insert({
      name: form.name,
      duration: parseInt(form.duration) || 0,
      sets: parseInt(form.sets) || 0,
      calories_burned: parseInt(form.calories_burned) || 0,
      time_of_day: form.time_of_day || "",
      date: dateStr,
    });
    if (!error) { setForm({}); fetchAll(); }
  }

  async function lookupBarcode(code) {
    if (!code.trim()) return;
    setScanLoading(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const nutrients = p.nutriments || {};
        setForm({
          name: p.product_name || "Không rõ tên",
          calories: Math.round(nutrients["energy-kcal_100g"] || nutrients["energy-kcal"] || 0),
          protein: Math.round(nutrients["proteins_100g"] || 0),
          carbs: Math.round(nutrients["carbohydrates_100g"] || 0),
          fat: Math.round(nutrients["fat_100g"] || 0),
        });
        setBarcodeInput("");
        stopScanner();
      } else {
        alert("Không tìm thấy sản phẩm!");
      }
    } catch (e) {
      alert("Lỗi kết nối!");
    }
    setScanLoading(false);
  }

  async function startScanner() {
    setScanning(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (code) => { lookupBarcode(code); },
          () => {}
        );
      } catch (e) {
        alert("Không truy cập được camera!");
        setScanning(false);
      }
    }, 300);
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (e) {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function scanWorkoutImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImgLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(",")[1];
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.REACT_APP_GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inline_data: { mime_type: file.type, data: base64 } },
                  { text: `Đây là ảnh kết quả buổi tập/chạy bộ. Trả về JSON thuần (không markdown):\n{"name":"tên hoạt động","duration":số phút,"calories_burned":số calories,"time_of_day":"giờ nếu có"}\nNếu không đọc được thì để 0 hoặc chuỗi rỗng.` }
                ]
              }]
            })
          }
        );
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        setForm({
          name: parsed.name || "Buổi tập",
          duration: parsed.duration || 0,
          calories_burned: parsed.calories_burned || 0,
          time_of_day: parsed.time_of_day || "",
          sets: 0,
        });
      } catch (e) {
        alert("Không đọc được ảnh — nhập tay nhé!");
      }
      setImgLoading(false);
    };
    reader.readAsDataURL(file);
  }

  async function deleteItem(table, id) {
    await supabase.from(table).delete().eq("id", id);
    fetchAll();
  }

  const totalCaloriesIn = nutritionLog.reduce((s, n) => s + (n.calories || 0), 0);
  const totalProtein = nutritionLog.reduce((s, n) => s + (n.protein || 0), 0);
  const totalCarbs = nutritionLog.reduce((s, n) => s + (n.carbs || 0), 0);
  const totalFat = nutritionLog.reduce((s, n) => s + (n.fat || 0), 0);
  const totalMacros = totalProtein + totalCarbs + totalFat || 1;
  const totalCaloriesBurned = workoutLog.reduce((s, w) => s + (w.calories_burned || 0), 0);
  const netCalories = totalCaloriesIn - totalCaloriesBurned;
  const totalDuration = workoutLog.reduce((s, w) => s + (w.duration || 0), 0);
  const habitsDone = Object.values(checkins).filter(c => c.done).length;

  return (
    <div className="app">
      <div className="back-row">
        <button className="btn-ghost" onClick={onBack}>←</button>
        <span className="screen-title">Schedule & Tracker</span>
      </div>

      {/* Date navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
        <button onClick={prevDay} style={{ background: "none", border: "none", color: "#a3e635", cursor: "pointer", fontSize: 20, padding: "0 8px" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#e8e6e1" }}>{displayDate}</div>
          {isToday() && <div style={{ fontSize: 10, color: "#a3e635", fontFamily: "DM Mono, monospace", letterSpacing: 2, marginTop: 2 }}>HÔM NAY</div>}
        </div>
        <button onClick={nextDay} disabled={isToday()}
          style={{ background: "none", border: "none", color: isToday() ? "#333" : "#a3e635", cursor: isToday() ? "default" : "pointer", fontSize: 20, padding: "0 8px" }}>→</button>
      </div>

      {/* Net calories banner */}
      <div style={{ background: netCalories > 2000 ? "#2a0f0f" : "#0f2a0f", border: `1px solid ${netCalories > 2000 ? "#ef4444" : "#a3e635"}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "DM Mono, monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Net calories</div>
          <div style={{ fontSize: 26, fontWeight: 500, color: netCalories > 2000 ? "#ef4444" : "#a3e635" }}>{netCalories}<span style={{ fontSize: 12, color: "#555", marginLeft: 4 }}>kcal</span></div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#555", lineHeight: 2 }}>
          <div>Nạp vào: <span style={{ color: "#ccc" }}>{totalCaloriesIn} kcal</span></div>
          <div>Đốt: <span style={{ color: "#ccc" }}>−{totalCaloriesBurned} kcal</span></div>
          <div>Habits: <span style={{ color: "#a3e635" }}>{habitsDone}/{habits.length}</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["nutrition", "workout", "habits"].map((t) => (
          <button key={t} onClick={() => { setTab(t); setForm({}); }}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.15s", background: tab === t ? "#a3e635" : "#1a1a1a", color: tab === t ? "#0a0a0a" : "#666" }}>
            {t === "nutrition" ? "Dinh dưỡng" : t === "workout" ? "Tập luyện" : "Habits"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#555" }}>Đang tải...</div>
      ) : (
        <>
          {/* ── NUTRITION TAB ── */}
          {tab === "nutrition" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "Calories", value: totalCaloriesIn, unit: "kcal", color: "#a3e635" },
                  { label: "Protein", value: totalProtein, unit: "g", color: "#38bdf8" },
                  { label: "Carbs", value: totalCarbs, unit: "g", color: "#fb923c" },
                  { label: "Fat", value: totalFat, unit: "g", color: "#f472b6" },
                ].map((item) => (
                  <div key={item.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "#555", fontFamily: "DM Mono, monospace", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 500, color: item.color }}>{item.value}<span style={{ fontSize: 12, color: "#555", marginLeft: 4 }}>{item.unit}</span></div>
                  </div>
                ))}
              </div>

              {totalMacros > 1 && (
                <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "20px", marginBottom: 20 }}>
                  <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#a3e635", marginBottom: 16 }}>Macro breakdown</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <DonutChart protein={totalProtein} carbs={totalCarbs} fat={totalFat} total={totalMacros} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { label: "Protein", value: totalProtein, color: "#38bdf8" },
                        { label: "Carbs", value: totalCarbs, color: "#fb923c" },
                        { label: "Fat", value: totalFat, color: "#f472b6" },
                      ].map((m) => (
                        <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} />
                          <span style={{ fontSize: 13, color: "#999" }}>{m.label}</span>
                          <span style={{ fontSize: 13, color: "#ccc", marginLeft: 4 }}>{Math.round((m.value / totalMacros) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "18px", marginBottom: 16 }}>
                <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#666", marginBottom: 14 }}>Thêm món ăn</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input className="input" placeholder="Nhập barcode..." value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && lookupBarcode(barcodeInput)}
                    style={{ flex: 1 }} />
                  <button onClick={() => lookupBarcode(barcodeInput)} disabled={scanLoading}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#1a1a1a", color: "#a3e635", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
                    {scanLoading ? "..." : "Tìm"}
                  </button>
                  <button onClick={scanning ? stopScanner : startScanner}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: scanning ? "#2a0f0f" : "#1a1a1a", color: scanning ? "#ef4444" : "#a3e635", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
                    {scanning ? "Dừng" : "Quét"}
                  </button>
                </div>
                {scanning && <div id="qr-reader" style={{ width: "100%", borderRadius: 10, overflow: "hidden", marginBottom: 10 }} />}
                <input className="input" placeholder="Tên món ăn..." value={form.name || ""}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  style={{ width: "100%", marginBottom: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 14 }}>
                  {["calories", "protein", "carbs", "fat"].map((field) => (
                    <input key={field} className="input" type="number"
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1) + (field === "calories" ? " (kcal)" : " (g)")}
                      value={form[field] || ""}
                      onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} />
                  ))}
                </div>
                <button className="btn btn-full" onClick={addNutrition}>Thêm món</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nutritionLog.length === 0 ? (
                  <div className="empty">Chưa có gì ngày này</div>
                ) : nutritionLog.map((item) => (
                  <div key={item.id} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{item.calories} kcal · {item.protein}g P · {item.carbs}g C · {item.fat}g F</div>
                    </div>
                    <button onClick={() => deleteItem("nutrition", item.id)}
                      style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>×</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── WORKOUT TAB ── */}
          {tab === "workout" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "Thời gian", value: totalDuration, unit: "phút", color: "#a3e635" },
                  { label: "Đốt calo", value: totalCaloriesBurned, unit: "kcal", color: "#fb923c" },
                  { label: "Bài tập", value: workoutLog.length, unit: "bài", color: "#38bdf8" },
                ].map((item) => (
                  <div key={item.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "12px" }}>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono, monospace", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: item.color }}>{item.value}<span style={{ fontSize: 11, color: "#555", marginLeft: 3 }}>{item.unit}</span></div>
                  </div>
                ))}
              </div>

              {workoutLog.length > 0 && (
                <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "20px", marginBottom: 20 }}>
                  <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#a3e635", marginBottom: 16 }}>Timeline</div>
                  {workoutLog.map((w, i) => (
                    <div key={w.id} style={{ display: "flex", gap: 14, paddingBottom: i < workoutLog.length - 1 ? 16 : 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#a3e635", flexShrink: 0, marginTop: 3 }} />
                        {i < workoutLog.length - 1 && <div style={{ width: 1, flex: 1, background: "#222", marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}>{w.name}</div>
                          <button onClick={() => deleteItem("workouts", w.id)}
                            style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
                        </div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                          {w.time_of_day && `${w.time_of_day} · `}{w.duration} phút{w.sets > 0 && ` · ${w.sets} sets`}{w.calories_burned > 0 && ` · −${w.calories_burned} kcal`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "18px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>Thêm bài tập</div>
                  <button onClick={() => imgInputRef.current?.click()} disabled={imgLoading}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#1a1a1a", color: "#a3e635", cursor: "pointer", fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>
                    {imgLoading ? "Đang đọc..." : "Quét ảnh"}
                  </button>
                  <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={scanWorkoutImage} />
                </div>
                <input className="input" placeholder="Tên bài tập..." value={form.name || ""}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  style={{ width: "100%", marginBottom: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 14 }}>
                  <input className="input" type="number" placeholder="Phút" value={form.duration || ""}
                    onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} />
                  <input className="input" type="number" placeholder="Calories đốt (kcal)" value={form.calories_burned || ""}
                    onChange={(e) => setForm((p) => ({ ...p, calories_burned: e.target.value }))} />
                  <input className="input" type="number" placeholder="Sets" value={form.sets || ""}
                    onChange={(e) => setForm((p) => ({ ...p, sets: e.target.value }))} />
                  <input className="input" placeholder="Giờ (vd: 7:00)" value={form.time_of_day || ""}
                    onChange={(e) => setForm((p) => ({ ...p, time_of_day: e.target.value }))} />
                </div>
                <button className="btn btn-full" onClick={addWorkout}>Thêm bài tập</button>
              </div>
            </>
          )}

          {/* ── HABITS TAB ── */}
          {tab === "habits" && (
            <>
              {/* Progress bar */}
              {habits.length > 0 && (
                <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>Tiến độ hôm nay</div>
                    <div style={{ fontSize: 13, color: "#a3e635" }}>{habitsDone}/{habits.length}</div>
                  </div>
                  <div style={{ background: "#1e1e1e", borderRadius: 99, height: 6, overflow: "hidden" }}>
                    <div style={{ background: "#a3e635", height: "100%", borderRadius: 99, width: `${habits.length ? (habitsDone / habits.length) * 100 : 0}%`, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              )}

              {/* Habit list với check-in */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {habits.length === 0 ? (
                  <div className="empty">Chưa có habit nào</div>
                ) : habits.map((habit) => {
                  const checkin = checkins[habit.id];
                  const isDone = checkin?.done === true;
                  const isSkip = checkin?.done === false;
                  const streak = streaks[habit.id] || 0;
                  return (
                    <div key={habit.id} style={{ background: "#111", border: `1px solid ${isDone ? "#1e3a0a" : isSkip ? "#2a0f0f" : "#1e1e1e"}`, borderRadius: 14, padding: "16px 18px", animation: "fadeIn 0.2s ease" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: "#ddd" }}>{habit.name}</div>
                          {streak > 0 && (
                            <div style={{ fontSize: 11, color: "#a3e635", marginTop: 3, fontFamily: "DM Mono, monospace" }}>
                              {streak} ngày liên tiếp
                            </div>
                          )}
                        </div>
                        <button onClick={() => deleteHabit(habit.id)}
                          style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => saveCheckin(habit.id, true)}
                          style={{ flex: 1, padding: "8px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontFamily: "DM Sans, sans-serif", fontWeight: isDone ? 600 : 400, background: isDone ? "#1a3a0a" : "#0f0f0f", color: isDone ? "#a3e635" : "#555", border: isDone ? "1px solid #a3e635" : "1px solid #222", transition: "all 0.15s" }}>
                          ✓ Xong
                        </button>
                        <button onClick={() => saveCheckin(habit.id, false)}
                          style={{ flex: 1, padding: "8px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontFamily: "DM Sans, sans-serif", fontWeight: isSkip ? 600 : 400, background: isSkip ? "#2a0f0f" : "#0f0f0f", color: isSkip ? "#ef4444" : "#555", border: isSkip ? "1px solid #ef4444" : "1px solid #222", transition: "all 0.15s" }}>
                          ✗ Skip
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Thêm habit mới */}
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" placeholder="Thêm habit mới..." value={newHabit}
                  onChange={(e) => setNewHabit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHabit()}
                  style={{ flex: 1 }} />
                <button className="btn" onClick={addHabit}>Thêm</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DonutChart({ protein, carbs, fat, total }) {
  const size = 100, r = 36, cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  const segments = [
    { value: protein, color: "#38bdf8" },
    { value: carbs, color: "#fb923c" },
    { value: fat, color: "#f472b6" },
  ];
  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.value / total) * circumference;
    const arc = { dash, offset: -offset, color: seg.color };
    offset += dash;
    return arc;
  });
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e1e" strokeWidth="16" />
      {arcs.map((arc, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={arc.color} strokeWidth="16"
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={arc.offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "all 0.3s" }} />
      ))}
      <text x={cx} y={cy + 5} textAnchor="middle" fill="#666" fontSize="11" fontFamily="DM Mono, monospace">{total}g</text>
    </svg>
  );
}

export default Schedule;