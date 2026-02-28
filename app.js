const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const store = {
    get(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch { return fallback; }
    },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

function todayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

let state = store.get("pcc_state", {
    theme: "dark",
    taskFilter: "all",
    search: "",
    tasks: [
        { id: crypto.randomUUID(), text: "Ship PCC v1 (tasks/habits/pomodoro/notes)", lane: "doing", done: false, created: Date.now() }
    ],
    habits: [
        { id: crypto.randomUUID(), name: "30min coding", streak: 1, best: 1, lastDone: todayKey() }
    ],
    notes: [
        { id: crypto.randomUUID(), title: "Next Steps", text: "Add PWA + drag/drop + charts", created: Date.now() }
    ],
    pomodoro: {
        focusMin: 25,
        breakMin: 5,
        mode: "focus",
        secondsLeft: 25 * 60,
        running: false,
        sessionsToday: 0,
        dayKey: todayKey()
    }
});

function save(){
    store.set("pcc_state", state);
}

function applyTheme(){
    document.body.classList.toggle("light", state.theme === "light");
    $("#themeBtn").textContent = state.theme === "light" ? "🌞" : "🌙";
}

function setSearch(val){
    state.search = val.toLowerCase().trim();
    save(); render();
}

function setFilter(f){
    state.taskFilter = f;
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.filter === f));
    save(); render();
}

function matchesSearch(text){
    if(!state.search) return true;
    return text.toLowerCase().includes(state.search);
}

/* ---------- Tasks ---------- */
function addTask(){
    const input = $("#taskInput");
    const lane = $("#taskLane").value;
    const text = input.value.trim();
    if(!text) return;

    state.tasks.unshift({
        id: crypto.randomUUID(),
        text,
        lane,
        done: lane === "done",
        created: Date.now()
    });

    input.value = "";
    save(); render();
}

function moveTask(id, dir){
    const t = state.tasks.find(x => x.id === id);
    if(!t) return;

    const order = ["backlog", "doing", "done"];
    let idx = order.indexOf(t.lane);
    idx = Math.max(0, Math.min(order.length-1, idx + dir));
    t.lane = order[idx];
    t.done = t.lane === "done";

    save(); render();
}

function editTask(id){
    const t = state.tasks.find(x => x.id === id);
    if(!t) return;
    const next = prompt("Edit task:", t.text);
    if(next === null) return;
    const v = next.trim();
    if(!v) return;
    t.text = v;
    save(); render();
}

function deleteTask(id){
    state.tasks = state.tasks.filter(t => t.id !== id);
    save(); render();
}

function taskVisible(t){
    const filterOk =
        state.taskFilter === "all" ? true :
            state.taskFilter === "active" ? !t.done :
                state.taskFilter === "done" ? t.done : true;

    return filterOk && matchesSearch(t.text);
}

function renderTasks(){
    const lanes = {
        backlog: $("#laneBacklog"),
        doing: $("#laneDoing"),
        done: $("#laneDone")
    };

    Object.values(lanes).forEach(el => el.innerHTML = "");

    state.tasks
        .filter(taskVisible)
        .forEach(t => {
            const el = document.createElement("div");
            el.className = "task";
            el.innerHTML = `
        <div class="row">
          <div class="txt">${escapeHtml(t.text)}</div>
          <div class="mini">
            <button class="iconbtn" data-act="left" title="Move left">◀</button>
            <button class="iconbtn" data-act="right" title="Move right">▶</button>
            <button class="iconbtn" data-act="edit" title="Edit">✎</button>
            <button class="iconbtn" data-act="del" title="Delete">🗑</button>
          </div>
        </div>
      `;

            // ✅ Drag settings
            el.setAttribute("draggable", "true");
            el.dataset.id = t.id;

            el.addEventListener("dragstart", () => {
                el.classList.add("dragging");
            });

            el.addEventListener("dragend", () => {
                el.classList.remove("dragging");
            });

            el.querySelector('[data-act="left"]').onclick = () => moveTask(t.id, -1);
            el.querySelector('[data-act="right"]').onclick = () => moveTask(t.id, +1);
            el.querySelector('[data-act="edit"]').onclick = () => editTask(t.id);
            el.querySelector('[data-act="del"]').onclick = () => deleteTask(t.id);

            lanes[t.lane].appendChild(el);
        });

    // ✅ drag & drop lanes
    Object.entries(lanes).forEach(([laneKey, laneEl]) => {
        const laneBox = laneEl.parentElement;

        laneBox.addEventListener("dragover", (e) => {
            e.preventDefault();
            laneBox.classList.add("dragover");
        });

        laneBox.addEventListener("dragleave", () => {
            laneBox.classList.remove("dragover");
        });

        laneBox.addEventListener("drop", (e) => {
            e.preventDefault();
            laneBox.classList.remove("dragover");

            const dragging = document.querySelector(".task.dragging");
            if(!dragging) return;

            const id = dragging.dataset.id;
            const task = state.tasks.find(x => x.id === id);
            if(!task) return;

            task.lane = laneKey;
            task.done = laneKey === "done";
            save(); render();
        });
    });
}

/* ---------- Habits ---------- */
function addHabit(){
    const input = $("#habitInput");
    const name = input.value.trim();
    if(!name) return;
    state.habits.unshift({
        id: crypto.randomUUID(),
        name,
        streak: 0,
        best: 0,
        lastDone: null
    });
    input.value = "";
    save(); render();
}

function markHabitDone(id){
    const h = state.habits.find(x => x.id === id);
    if(!h) return;

    const today = todayKey();
    if(h.lastDone === today) return;

    const y = new Date(); y.setDate(y.getDate()-1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;

    if(h.lastDone === yesterday) h.streak += 1;
    else h.streak = 1;

    h.best = Math.max(h.best, h.streak);
    h.lastDone = today;

    save(); render();
}

function deleteHabit(id){
    state.habits = state.habits.filter(h => h.id !== id);
    save(); render();
}

function renderHabits(){
    const wrap = $("#habitList");
    wrap.innerHTML = "";

    state.habits
        .filter(h => matchesSearch(h.name))
        .forEach(h => {
            const el = document.createElement("div");
            el.className = "habitItem";
            const doneToday = h.lastDone === todayKey();
            el.innerHTML = `
        <div class="habitTop">
          <div>
            <div class="habitName">${escapeHtml(h.name)}</div>
            <div class="streak">Streak: <b>${h.streak}</b> • Best: <b>${h.best}</b> ${doneToday ? "• ✅ today" : ""}</div>
          </div>
          <div class="mini">
            <button class="iconbtn" data-act="done">Done</button>
            <button class="iconbtn" data-act="del">🗑</button>
          </div>
        </div>
      `;
            el.querySelector('[data-act="done"]').onclick = () => markHabitDone(h.id);
            el.querySelector('[data-act="del"]').onclick = () => deleteHabit(h.id);
            wrap.appendChild(el);
        });
}

/* ---------- Notes ---------- */
function addNote(){
    const title = $("#noteTitle").value.trim() || "Untitled";
    const text = $("#noteText").value.trim();
    if(!text) return;

    state.notes.unshift({
        id: crypto.randomUUID(),
        title,
        text,
        created: Date.now()
    });

    $("#noteTitle").value = "";
    $("#noteText").value = "";
    save(); render();
}

function deleteNote(id){
    state.notes = state.notes.filter(n => n.id !== id);
    save(); render();
}

function renderNotes(){
    const wrap = $("#noteList");
    wrap.innerHTML = "";

    state.notes
        .filter(n => matchesSearch(n.title) || matchesSearch(n.text))
        .forEach(n => {
            const el = document.createElement("div");
            el.className = "noteItem";
            el.innerHTML = `
        <div class="noteTop">
          <div class="noteTitle">${escapeHtml(n.title)}</div>
          <button class="iconbtn" data-act="del">🗑</button>
        </div>
        <div class="noteText">${escapeHtml(n.text)}</div>
      `;
            el.querySelector('[data-act="del"]').onclick = () => deleteNote(n.id);
            wrap.appendChild(el);
        });
}

/* ---------- Pomodoro ---------- */
let tickHandle = null;

function pomodoroEnsureDay(){
    const k = todayKey();
    if(state.pomodoro.dayKey !== k){
        state.pomodoro.dayKey = k;
        state.pomodoro.sessionsToday = 0;
    }
}

function pomodoroSetProfile(focus, brk){
    state.pomodoro.focusMin = focus;
    state.pomodoro.breakMin = brk;
    state.pomodoro.mode = "focus";
    state.pomodoro.secondsLeft = focus * 60;
    state.pomodoro.running = false;
    clearInterval(tickHandle); tickHandle = null;
    save(); renderPomodoro();
    renderStats();
}

function pomodoroStart(){
    pomodoroEnsureDay();
    if(state.pomodoro.running) return;
    state.pomodoro.running = true;

    tickHandle = setInterval(() => {
        state.pomodoro.secondsLeft -= 1;
        if(state.pomodoro.secondsLeft <= 0){
            if(state.pomodoro.mode === "focus"){
                state.pomodoro.sessionsToday += 1;
                state.pomodoro.mode = "break";
                state.pomodoro.secondsLeft = state.pomodoro.breakMin * 60;
            } else {
                state.pomodoro.mode = "focus";
                state.pomodoro.secondsLeft = state.pomodoro.focusMin * 60;
            }
        }
        save();
        renderPomodoro();
        renderStats();
    }, 1000);

    save(); renderPomodoro();
    renderStats();
}

function pomodoroPause(){
    state.pomodoro.running = false;
    clearInterval(tickHandle); tickHandle = null;
    save(); renderPomodoro();
    renderStats();
}

function pomodoroReset(){
    state.pomodoro.mode = "focus";
    state.pomodoro.secondsLeft = state.pomodoro.focusMin * 60;
    state.pomodoro.running = false;
    clearInterval(tickHandle); tickHandle = null;
    save(); renderPomodoro();
    renderStats();
}

function fmtTime(sec){
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function renderPomodoro(){
    pomodoroEnsureDay();
    $("#timer").textContent = fmtTime(state.pomodoro.secondsLeft);
    $("#sessions").textContent = String(state.pomodoro.sessionsToday);
    $("#pomoMode").textContent = state.pomodoro.mode === "focus" ? "Focus" : "Break";
}

/* ---------- Stats ---------- */
function renderStats(){
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.lane === "done").length;
    const active = total - done;
    const bestStreak = state.habits.reduce((m,h) => Math.max(m, h.best), 0);

    const rate = total === 0 ? 0 : Math.round((done / total) * 100);

    $("#statDone").textContent = String(done);
    $("#statActive").textContent = String(active);
    $("#statStreak").textContent = String(bestStreak);

    const totalEl = $("#statTotal");
    const rateEl = $("#statRate");
    const pomoEl = $("#statPomo");
    if(totalEl) totalEl.textContent = String(total);
    if(rateEl) rateEl.textContent = `${rate}%`;
    if(pomoEl) pomoEl.textContent = String(state.pomodoro.sessionsToday || 0);
}

/* ---------- Utils ---------- */
function escapeHtml(str){
    return str
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

/* ---------- Events ---------- */
$("#addTask").onclick = addTask;
$("#taskInput").addEventListener("keydown", (e) => { if(e.key === "Enter") addTask(); });

$("#addHabit").onclick = addHabit;
$("#habitInput").addEventListener("keydown", (e) => { if(e.key === "Enter") addHabit(); });

$("#addNote").onclick = addNote;
$("#noteText").addEventListener("keydown", (e) => { if(e.key === "Enter") addNote(); });

$("#themeBtn").onclick = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    save(); applyTheme();
};

$("#search").addEventListener("input", (e) => setSearch(e.target.value));
$$(".tab").forEach(t => t.onclick = () => setFilter(t.dataset.filter));

$("#pomoStart").onclick = pomodoroStart;
$("#pomoPause").onclick = pomodoroPause;
$("#pomoReset").onclick = pomodoroReset;
$("#setFocus").onclick = () => pomodoroSetProfile(25,5);
$("#setDeep").onclick = () => pomodoroSetProfile(50,10);

/* ✅ Export / Import */
$("#exportBtn").onclick = () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pcc-backup.json";
    a.click();
    URL.revokeObjectURL(url);
};

$("#importBtn").onclick = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
        const file = input.files?.[0];
        if(!file) return;
        try{
            const text = await file.text();
            const imported = JSON.parse(text);
            if(!imported || typeof imported !== "object") throw new Error("Invalid file");
            state = imported;
            save();
            render();
            alert("Imported ✅");
        }catch(e){
            alert("Import failed ❌");
        }
    };
    input.click();
};

/* ---------- Init ---------- */
function render(){
    applyTheme();
    $("#search").value = state.search || "";
    renderTasks();
    renderHabits();
    renderNotes();
    renderPomodoro();
    renderStats();
}
render();