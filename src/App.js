import { useState, useEffect } from "react";
import "./App.css";
import supabase from "./supabase";
import Schedule from "./Schedule";

function App() {
  const [screen, setScreen] = useState("home");
  const [coaching, setCoaching] = useState("");
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [stats, setStats] = useState({ netCalories: 0, habitsDone: 0, habitsTotal: 0, bestStreak: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    setLoadingStats(true);
    const [{ data: nutrition }, { data: workouts }, { data: habits }, { data: checkins }] = await Promise.all([
      supabase.from("nutrition").select("calories").eq("date", today),
      supabase.from("workouts").select("calories_burned").eq("date", today),
      supabase.from("habits").select("id"),
      supabase.from("checkins").select("habit_id, done").eq("date", today),
    ]);

    const totalIn = (nutrition || []).reduce((s, n) => s + (n.calories || 0), 0);
    const totalBurned = (workouts || []).reduce((s, w) => s + (w.calories_burned || 0), 0);
    const habitsDone = (checkins || []).filter(c => c.done === true || c.done === "true").length;

    let bestStreak = 0;
    for (const habit of (habits || [])) {
      const { data: logs } = await supabase
        .from("checkins").select("date, done")
        .eq("habit_id", habit.id).eq("done", true)
        .order("date", { ascending: false });
      let streak = 0;
      const now = new Date();
      for (let i = 0; i < (logs?.length || 0); i++) {
        const expected = new Date(now);
        expected.setDate(expected.getDate() - i);
        if (logs[i].date === expected.toISOString().split("T")[0]) streak++;
        else break;
      }
      if (streak > bestStreak) bestStreak = streak;
    }

    setStats({ netCalories: totalIn - totalBurned, habitsDone, habitsTotal: (habits || []).length, bestStreak });
    setLoadingStats(false);
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Chào buổi sáng";
    if (h < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }

  async function getAICoach() {
    setLoadingCoach(true);
    setScreen("coach");
    const { data: logs } = await supabase
      .from("checkins").select("*, habits(name)")
      .order("date", { ascending: false }).limit(30);
    const summary = logs?.map(l =>
      `${l.habits?.name}: ${l.done ? "done" : "skip"} (${l.date}${l.skip_reason ? ", lý do: " + l.skip_reason : ""})`
    ).join("\n") || "Chưa có data";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.REACT_APP_GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Bạn là một habit coach thực tế, thẳng thắn. Phân tích dữ liệu check-in sau và đưa ra nhận xét + 2-3 hành động cụ thể để cải thiện. Không động viên chung chung.\n\nDữ liệu:\n${summary}\n\nTrả lời bằng tiếng Việt, ngắn gọn, thực tế.` }] }]
        })
      }
    );
    const data = await response.json();
    setCoaching(data.candidates?.[0]?.content?.parts?.[0]?.text || "Không lấy được phản hồi.");
    setLoadingCoach(false);
  }

  if (showSchedule) return <Schedule onBack={() => { setShowSchedule(false); fetchStats(); }} />;

  return (
    <div className="app">
      {screen === "home" && (
        <>
          <div className="header" style={{ marginBottom: 32 }}>
            <div className="logo">Habit Coach</div>
            <h1 className="title">{getGreeting()}<span style={{color: "#a3e635"}}>.</span></h1>
            <div style={{ fontSize: 13, color: "#555", marginTop: 8, fontFamily: "DM Mono, monospace" }}>
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
            </div>
          </div>

          {loadingStats ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#555", fontSize: 14 }}>Đang tải...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 28 }}>
              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "18px" }}>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono, monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Net calories</div>
                <div style={{ fontSize: 26, fontWeight: 500, color: stats.netCalories > 2000 ? "#ef4444" : "#a3e635" }}>
                  {stats.netCalories}<span style={{ fontSize: 12, color: "#555", marginLeft: 4 }}>kcal</span>
                </div>
              </div>

              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "18px" }}>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono, monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Habits hôm nay</div>
                <div style={{ fontSize: 26, fontWeight: 500, color: "#a3e635" }}>
                  {stats.habitsDone}<span style={{ fontSize: 14, color: "#444", marginLeft: 2 }}>/{stats.habitsTotal}</span>
                </div>
                {stats.habitsTotal > 0 && (
                  <div style={{ marginTop: 8, background: "#1e1e1e", borderRadius: 99, height: 4, overflow: "hidden" }}>
                    <div style={{ background: "#a3e635", height: "100%", borderRadius: 99, width: `${(stats.habitsDone / stats.habitsTotal) * 100}%`, transition: "width 0.4s ease" }} />
                  </div>
                )}
              </div>

              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "18px", gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono, monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Streak tốt nhất</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 26, fontWeight: 500, color: "#a3e635" }}>{stats.bestStreak}</div>
                  <div style={{ fontSize: 13, color: "#555" }}>ngày liên tiếp</div>
                  {stats.bestStreak >= 7 && (
                    <div style={{ fontSize: 12, color: "#a3e635", background: "#1a3a0a", padding: "2px 10px", borderRadius: 99, border: "1px solid #2a5a0a" }}>on fire</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn btn-full" onClick={() => setShowSchedule(true)}>
              Schedule & Tracker
            </button>
            <button className="btn btn-full btn-dark" onClick={getAICoach}>
              Xem AI Coach
            </button>
          </div>
        </>
      )}

      {screen === "coach" && (
        <>
          <div className="back-row">
            <button className="btn-ghost" onClick={() => setScreen("home")}>←</button>
            <span className="screen-title">AI Coach</span>
          </div>
          {loadingCoach ? (
            <div className="loading-box">
              <p className="dot-pulse">Đang phân tích habits của bạn</p>
            </div>
          ) : (
            <div className="coach-box">
              <div className="coach-label">Phân tích</div>
              {coaching}
            </div>
          )}
          <button className="btn btn-full btn-dark" onClick={getAICoach}>Phân tích lại</button>
        </>
      )}
    </div>
  );
}

export default App;