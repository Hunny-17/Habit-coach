import { useState, useEffect } from "react";
import "./App.css";
import supabase from "./supabase";
import Schedule from "./Schedule";

function App() {
  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState("");
  const [checkins, setCheckins] = useState({});
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [coaching, setCoaching] = useState("");
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    fetchHabits();
  }, []);

  async function fetchHabits() {
    const { data, error } = await supabase
      .from("habits")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.log(error);
    else setHabits(data);
    setLoading(false);
  }

  async function addHabit() {
    if (!newHabit.trim()) return;
    const { error } = await supabase
      .from("habits")
      .insert({ name: newHabit, user_id: null });
    if (error) console.log(error);
    else {
      setNewHabit("");
      fetchHabits();
    }
  }

  async function saveCheckin(habitId, done, skipReason = null) {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("checkins").upsert({
      habit_id: habitId,
      user_id: null,
      done,
      skip_reason: skipReason,
      date: today,
    });
    if (error) console.log(error);
    else setCheckins((prev) => ({ ...prev, [habitId]: { done, skipReason } }));
  }

  async function getAICoach() {
    setLoadingCoach(true);
    setScreen("coach");
    const { data: logs } = await supabase
      .from("checkins")
      .select("*, habits(name)")
      .order("date", { ascending: false })
      .limit(30);
    const summary =
      logs
        ?.map(
          (l) =>
            `${l.habits?.name}: ${l.done ? "done" : "skip"} (${l.date}${l.skip_reason ? ", lý do: " + l.skip_reason : ""})`,
        )
        .join("\n") || "Chưa có data";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.REACT_APP_GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Bạn là một habit coach thực tế, thẳng thắn. Phân tích dữ liệu check-in sau và đưa ra nhận xét + 2-3 hành động cụ thể để cải thiện. Không động viên chung chung.\n\nDữ liệu:\n${summary}\n\nTrả lời bằng tiếng Việt, ngắn gọn, thực tế.`,
                },
              ],
            },
          ],
        }),
      },
    );
    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Không lấy được phản hồi.";
    setCoaching(text);
    setLoadingCoach(false);
  }

  if (loading) return null;
  if (showSchedule) return <Schedule onBack={() => setShowSchedule(false)} />;
  return (
    <div className="app">
      {screen === "home" && (
        <>
          <div className="header">
            <div className="logo">Habit Tracker</div>
            <h1 className="title">
              Build better
              <br />
              <span>habits.</span>
            </h1>
          </div>
          <div className="input-row">
            <input
              className="input"
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              placeholder="Thêm habit mới..."
            />
            <button className="btn" onClick={addHabit}>
              Thêm
            </button>
          </div>
          {habits.length === 0 ? (
            <div className="empty">
              Chưa có habit nào — thêm cái đầu tiên đi!
            </div>
          ) : (
            <div className="habit-list">
              {habits.map((habit) => (
                <div key={habit.id} className="habit-card">
                  <div className="habit-dot" />
                  {habit.name}
                </div>
              ))}
            </div>
          )}
          {habits.length > 0 && (
            <div className="action-grid">
              <button
                className="btn btn-full"
                onClick={() => setScreen("checkin")}
              >
                Check-in hôm nay
              </button>
              <button className="btn btn-full btn-dark" onClick={getAICoach}>
                Xem AI Coach
              </button>
              <button
                className="btn btn-full btn-dark"
                onClick={() => setShowSchedule(true)}
              >
                Schedule & Tracker
              </button>
            </div>
          )}
        </>
      )}

      {screen === "checkin" && (
        <>
          <div className="back-row">
            <button className="btn-ghost" onClick={() => setScreen("home")}>
              ←
            </button>
            <span className="screen-title">Check-in hôm nay</span>
          </div>
          <div className="checkin-list">
            {habits.map((habit) => (
              <div key={habit.id} className="checkin-card">
                <div className="checkin-name">{habit.name}</div>
                <div className="checkin-btns">
                  <button
                    className={`checkin-btn ${checkins[habit.id]?.done === true ? "done" : ""}`}
                    onClick={() => saveCheckin(habit.id, true)}
                  >
                    ✓ Xong
                  </button>
                  <button
                    className={`checkin-btn ${checkins[habit.id]?.done === false ? "skip" : ""}`}
                    onClick={() => saveCheckin(habit.id, false, "Quên")}
                  >
                    ✗ Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-full" onClick={() => setScreen("home")}>
            Xong
          </button>
        </>
      )}

      {screen === "coach" && (
        <>
          <div className="back-row">
            <button className="btn-ghost" onClick={() => setScreen("home")}>
              ←
            </button>
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
          <button className="btn btn-full btn-dark" onClick={getAICoach}>
            Phân tích lại
          </button>
        </>
      )}
    </div>
  );
}

export default App;
