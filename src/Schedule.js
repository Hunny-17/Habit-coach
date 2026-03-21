import { useState, useEffect } from "react";
import supabase from "./supabase";

function Schedule({ onBack }) {
  const [tab, setTab] = useState("nutrition");
  const [nutritionLog, setNutritionLog] = useState([]);
  const [workoutLog, setWorkoutLog] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const { data: n } = await supabase
      .from("nutrition")
      .select("*")
      .eq("date", today)
      .order("created_at");
    const { data: w } = await supabase
      .from("workouts")
      .select("*")
      .eq("date", today)
      .order("created_at");
    setNutritionLog(n || []);
    setWorkoutLog(w || []);
    setLoading(false);
  }

  async function addNutrition() {
    if (!form.name) return;
    const { error } = await supabase.from("nutrition").insert({
      name: form.name,
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
      date: today,
    });
    if (!error) {
      setForm({});
      fetchAll();
    }
  }

  async function addWorkout() {
    if (!form.name) return;
    const { error } = await supabase.from("workouts").insert({
      name: form.name,
      duration: parseInt(form.duration) || 0,
      sets: parseInt(form.sets) || 0,
      time_of_day: form.time_of_day || "",
      date: today,
    });
    if (!error) {
      setForm({});
      fetchAll();
    }
  }

  async function deleteItem(table, id) {
    await supabase.from(table).delete().eq("id", id);
    fetchAll();
  }

  const totalCalories = nutritionLog.reduce((s, n) => s + (n.calories || 0), 0);
  const totalProtein = nutritionLog.reduce((s, n) => s + (n.protein || 0), 0);
  const totalCarbs = nutritionLog.reduce((s, n) => s + (n.carbs || 0), 0);
  const totalFat = nutritionLog.reduce((s, n) => s + (n.fat || 0), 0);
  const totalMacros = totalProtein + totalCarbs + totalFat || 1;

  const totalDuration = workoutLog.reduce((s, w) => s + (w.duration || 0), 0);

  if (loading) return null;

  return (
    <div className="app">
      <div className="back-row">
        <button className="btn-ghost" onClick={onBack}>
          ←
        </button>
        <span className="screen-title">Schedule & Tracker</span>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <button
          onClick={() => {
            setTab("nutrition");
            setForm({});
          }}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            fontSize: 14,
            fontWeight: 500,
            transition: "all 0.15s",
            background: tab === "nutrition" ? "#a3e635" : "#1a1a1a",
            color: tab === "nutrition" ? "#0a0a0a" : "#666",
          }}
        >
          Dinh dưỡng
        </button>
        <button
          onClick={() => {
            setTab("workout");
            setForm({});
          }}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            fontSize: 14,
            fontWeight: 500,
            transition: "all 0.15s",
            background: tab === "workout" ? "#a3e635" : "#1a1a1a",
            color: tab === "workout" ? "#0a0a0a" : "#666",
          }}
        >
          Tập luyện
        </button>
      </div>

      {tab === "nutrition" && (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {[
              {
                label: "Calories",
                value: totalCalories,
                unit: "kcal",
                color: "#a3e635",
              },
              {
                label: "Protein",
                value: totalProtein,
                unit: "g",
                color: "#38bdf8",
              },
              {
                label: "Carbs",
                value: totalCarbs,
                unit: "g",
                color: "#fb923c",
              },
              { label: "Fat", value: totalFat, unit: "g", color: "#f472b6" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "#111",
                  border: "1px solid #1e1e1e",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    fontFamily: "DM Mono, monospace",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{ fontSize: 22, fontWeight: 500, color: item.color }}
                >
                  {item.value}
                  <span style={{ fontSize: 12, color: "#555", marginLeft: 4 }}>
                    {item.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Donut chart */}
          {totalMacros > 1 && (
            <div
              style={{
                background: "#111",
                border: "1px solid #1e1e1e",
                borderRadius: 14,
                padding: "20px",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#a3e635",
                  marginBottom: 16,
                }}
              >
                Macro breakdown
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <DonutChart
                  protein={totalProtein}
                  carbs={totalCarbs}
                  fat={totalFat}
                  total={totalMacros}
                />
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {[
                    { label: "Protein", value: totalProtein, color: "#38bdf8" },
                    { label: "Carbs", value: totalCarbs, color: "#fb923c" },
                    { label: "Fat", value: totalFat, color: "#f472b6" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: m.color,
                        }}
                      />
                      <span style={{ fontSize: 13, color: "#999" }}>
                        {m.label}
                      </span>
                      <span
                        style={{ fontSize: 13, color: "#ccc", marginLeft: 4 }}
                      >
                        {Math.round((m.value / totalMacros) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Form nhập */}
          <div
            style={{
              background: "#111",
              border: "1px solid #1e1e1e",
              borderRadius: 14,
              padding: "18px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 14,
              }}
            >
              Thêm món ăn
            </div>
            <input
              className="input"
              placeholder="Tên món ăn..."
              value={form.name || ""}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              style={{ width: "100%", marginBottom: 10 }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {["calories", "protein", "carbs", "fat"].map((field) => (
                <input
                  key={field}
                  className="input"
                  type="number"
                  placeholder={
                    field.charAt(0).toUpperCase() +
                    field.slice(1) +
                    (field === "calories" ? " (kcal)" : " (g)")
                  }
                  value={form[field] || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [field]: e.target.value }))
                  }
                />
              ))}
            </div>
            <button className="btn btn-full" onClick={addNutrition}>
              Thêm món
            </button>
          </div>

          {/* Danh sách */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {nutritionLog.length === 0 ? (
              <div className="empty">Chưa có gì hôm nay</div>
            ) : (
              nutritionLog.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "#111",
                    border: "1px solid #1e1e1e",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    animation: "fadeIn 0.2s ease",
                  }}
                >
                  <div>
                    <div
                      style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                      {item.calories} kcal · {item.protein}g P · {item.carbs}g C
                      · {item.fat}g F
                    </div>
                  </div>
                  <button
                    onClick={() => deleteItem("nutrition", item.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#444",
                      cursor: "pointer",
                      fontSize: 16,
                      padding: "4px 8px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === "workout" && (
        <>
          {/* Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                background: "#111",
                border: "1px solid #1e1e1e",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#555",
                  fontFamily: "DM Mono, monospace",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Tổng thời gian
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, color: "#a3e635" }}>
                {totalDuration}
                <span style={{ fontSize: 12, color: "#555", marginLeft: 4 }}>
                  phút
                </span>
              </div>
            </div>
            <div
              style={{
                background: "#111",
                border: "1px solid #1e1e1e",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#555",
                  fontFamily: "DM Mono, monospace",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Bài tập
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, color: "#a3e635" }}>
                {workoutLog.length}
                <span style={{ fontSize: 12, color: "#555", marginLeft: 4 }}>
                  bài
                </span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {workoutLog.length > 0 && (
            <div
              style={{
                background: "#111",
                border: "1px solid #1e1e1e",
                borderRadius: 14,
                padding: "20px",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#a3e635",
                  marginBottom: 16,
                }}
              >
                Timeline hôm nay
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {workoutLog.map((w, i) => (
                  <div
                    key={w.id}
                    style={{
                      display: "flex",
                      gap: 14,
                      paddingBottom: i < workoutLog.length - 1 ? 16 : 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "#a3e635",
                          flexShrink: 0,
                          marginTop: 3,
                        }}
                      />
                      {i < workoutLog.length - 1 && (
                        <div
                          style={{
                            width: 1,
                            flex: 1,
                            background: "#222",
                            marginTop: 4,
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        paddingBottom: i < workoutLog.length - 1 ? 4 : 0,
                      }}
                    >
                      <div
                        style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}
                      >
                        {w.name}
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#555", marginTop: 2 }}
                      >
                        {w.time_of_day && `${w.time_of_day} · `}
                        {w.duration} phút{w.sets > 0 && ` · ${w.sets} sets`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form nhập */}
          <div
            style={{
              background: "#111",
              border: "1px solid #1e1e1e",
              borderRadius: 14,
              padding: "18px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 14,
              }}
            >
              Thêm bài tập
            </div>
            <input
              className="input"
              placeholder="Tên bài tập... (vd: Chạy bộ)"
              value={form.name || ""}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              style={{ width: "100%", marginBottom: 10 }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <input
                className="input"
                type="number"
                placeholder="Phút"
                value={form.duration || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, duration: e.target.value }))
                }
              />
              <input
                className="input"
                type="number"
                placeholder="Sets"
                value={form.sets || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sets: e.target.value }))
                }
              />
              <input
                className="input"
                placeholder="Giờ (vd: 7:00)"
                value={form.time_of_day || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, time_of_day: e.target.value }))
                }
              />
            </div>
            <button className="btn btn-full" onClick={addWorkout}>
              Thêm bài tập
            </button>
          </div>

          {/* Danh sách */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {workoutLog.length === 0 ? (
              <div className="empty">Chưa có bài tập hôm nay</div>
            ) : (
              workoutLog.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "#111",
                    border: "1px solid #1e1e1e",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    animation: "fadeIn 0.2s ease",
                  }}
                >
                  <div>
                    <div
                      style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                      {item.time_of_day && `${item.time_of_day} · `}
                      {item.duration} phút
                      {item.sets > 0 && ` · ${item.sets} sets`}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteItem("workouts", item.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#444",
                      cursor: "pointer",
                      fontSize: 16,
                      padding: "4px 8px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DonutChart({ protein, carbs, fat, total }) {
  const size = 100;
  const r = 36;
  const cx = size / 2;
  const cy = size / 2;
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
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#1e1e1e"
        strokeWidth="16"
      />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="16"
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={arc.offset}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            transition: "all 0.3s",
          }}
        />
      ))}
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fill="#666"
        fontSize="11"
        fontFamily="DM Mono, monospace"
      >
        {total}g
      </text>
    </svg>
  );
}

export default Schedule;
