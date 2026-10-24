(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const config = window.NEURAL_ARENA_CONFIG || {};
  const configured = Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && !config.SUPABASE_URL.includes('PASTE_') && !config.SUPABASE_ANON_KEY.includes('PASTE_'));
  let client = null;
  let userId = null;
  let roomId = null;
  let roomCode = null;
  let room = null;
  let players = [];
  let channel = null;
  let refreshTimer = null;
  let toastTimer = null;
  let busy = false;

  const stageMeta = {
    1: {label:'ROUND 01', name:'Train the Brain', color:'cyan'},
    2: {label:'ROUND 02', name:'Debug the Machine', color:'violet'},
    3: {label:'ROUND 03', name:'Agent Battle', color:'amber'}
  };
  const options = {
    1: [
      {value:'threshold', title:'Threshold classifier', desc:'A simple rule separates low-moisture dry soil from healthy soil.', index:'A / FIT'},
      {value:'nearest', title:'Nearest-neighbor', desc:'Useful for local patterns, but extra complexity for this tiny one-dimensional rule.', index:'B / FLEX'},
      {value:'random', title:'Random guess', desc:'No learned pattern. The outcome is not tied to the measurements.', index:'C / BASE'}
    ],
    2: [
      {value:'train_only', title:'Fit on training data only', desc:'Split first; fit the scaler on training data, then transform both sets.', index:'A / SAFE'},
      {value:'all_data', title:'Fit before splitting', desc:'Leaks information from the test set into preprocessing.', index:'B / LEAK'},
      {value:'drop_test', title:'Remove the test set', desc:'Without held-out data, the evaluation cannot estimate generalization.', index:'C / RISK'}
    ],
    3: [
      {value:'explorer', title:'Scout', desc:'Explore the map and discover opportunity before committing resources.', index:'A / EXPLORE'},
      {value:'collector', title:'Harvester', desc:'Prioritize collecting energy efficiently when resources are plentiful.', index:'B / GATHER'},
      {value:'optimizer', title:'Optimizer', desc:'Balance movement and energy cost to perform well in changing conditions.', index:'C / ADAPT'}
    ]
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function showToast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
  }
  function setMessage(message) { $('homeMessage').textContent = message || ''; }
  function setBusy(value) {
    busy = value;
    ['createRoomBtn','joinRoomBtn','startMatchBtn','advanceStageBtn','rematchBtn','leaveRoomBtn','finishLeaveBtn'].forEach(id => {
      const el = $(id); if (el) el.disabled = value;
    });
    document.querySelectorAll('.choice-card').forEach(el => el.disabled = value || el.dataset.submitted === 'true');
    if (!value && room) renderRoom();
  }
  function nameValue() {
    const value = $('playerName').value.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (!value) { setMessage('Enter a codename first.'); $('playerName').focus(); return null; }
    return value;
  }
  function assertConfigured() {
    if (!configured || !window.supabase) {
      $('setupNotice').hidden = false;
      $('connectionLabel').textContent = 'SETUP REQUIRED';
      showToast('Finish Supabase setup before creating or joining live rooms.');
      return false;
    }
    return true;
  }
  async function ensureClient() {
    if (!assertConfigured()) throw new Error('Setup required. Open README.md and finish the Supabase setup first.');
    if (!client) {
      client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}
      });
    }
    const {data:{session}, error:sessionError} = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (session?.user) userId = session.user.id;
    else {
      const {data, error} = await client.auth.signInAnonymously();
      if (error) throw new Error(`Anonymous sign-in failed: ${error.message}. Enable Anonymous Sign-Ins in Supabase Authentication settings.`);
      userId = data.user.id;
    }
    $('connectionLabel').textContent = 'SYSTEM ONLINE';
    return client;
  }
  async function rpc(name, args) {
    await ensureClient();
    const {data, error} = await client.rpc(name, args);
    if (error) throw new Error(error.message || 'The server rejected that action.');
    return data;
  }
  function showHome() {
    $('homeView').hidden = false; $('roomView').hidden = true;
    $('setupNotice').hidden = configured;
  }
  function showRoom() { $('homeView').hidden = true; $('roomView').hidden = false; }
  function playerById(id) { return players.find(p => p.player_id === id); }
  function scoreTotal(player) { return (player.stage1_score || 0) + (player.stage2_score || 0) + (player.stage3_score || 0); }
  function choiceFor(player, stage) { return stage === 1 ? player.stage1_choice : stage === 2 ? player.stage2_choice : player.stage3_choice; }
  function pointsFor(player, stage) { return stage === 1 ? player.stage1_score : stage === 2 ? player.stage2_score : player.stage3_score; }
  function allSubmitted(stage) { return players.length >= 2 && players.every(p => Boolean(choiceFor(p, stage))); }

  async function createRoom() {
    const name = nameValue(); if (!name) return;
    setBusy(true); setMessage('Connecting to the arena…');
    try {
      const result = await rpc('create_room', {p_name:name});
      roomId = result.room_id; roomCode = result.code;
      sessionStorage.setItem('neuralArenaRoomId', roomId); sessionStorage.setItem('neuralArenaRoomCode', roomCode); sessionStorage.setItem('neuralArenaName', name);
      await refreshRoom(); subscribeRoom(); showRoom(); setMessage(''); showToast(`Arena created. Share code ${roomCode} with a friend.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function joinRoom() {
    const name = nameValue(); if (!name) return;
    const code = $('roomCodeInput').value.trim().toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,6);
    if (code.length !== 6) { setMessage('Enter the 6-character room code.'); $('roomCodeInput').focus(); return; }
    setBusy(true); setMessage('Finding your arena…');
    try {
      const id = await rpc('join_room', {p_code:code, p_name:name});
      roomId = id; roomCode = code;
      sessionStorage.setItem('neuralArenaRoomId', roomId); sessionStorage.setItem('neuralArenaRoomCode', roomCode); sessionStorage.setItem('neuralArenaName', name);
      await refreshRoom(); subscribeRoom(); showRoom(); setMessage(''); showToast(`Joined arena ${roomCode}. Good luck.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function refreshRoom() {
    if (!client || !roomId) return;
    const [roomResult, playersResult] = await Promise.all([
      client.from('neural_rooms').select('*').eq('id', roomId).single(),
      client.from('neural_players').select('*').eq('room_id', roomId).order('joined_at', {ascending:true})
    ]);
    if (roomResult.error || playersResult.error) {
      if (roomResult.error?.code === 'PGRST116' || roomResult.error?.message?.toLowerCase().includes('0 rows')) {
        clearRoomLocal(); showHome(); showToast('This room is no longer available. Create a new arena.');
      }
      return;
    }
    room = roomResult.data; players = playersResult.data || []; roomCode = room.code;
    renderRoom();
  }
  function subscribeRoom() {
    if (!client || !roomId) return;
    if (channel) client.removeChannel(channel);
    channel = client.channel(`neural-room-${roomId}`)
      .on('postgres_changes', {event:'*', schema:'public', table:'neural_rooms', filter:`id=eq.${roomId}`}, () => refreshRoom())
      .on('postgres_changes', {event:'*', schema:'public', table:'neural_players', filter:`room_id=eq.${roomId}`}, () => refreshRoom())
      .subscribe();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshRoom().catch(() => {}), 4000);
  }
  function renderPlayers() {
    $('playerCount').textContent = `${players.length}/4`;
    $('playersList').innerHTML = players.map((p, idx) => {
      const host = p.player_id === room.created_by;
      const isYou = p.player_id === userId;
      const completed = room.status === 'playing' && Boolean(choiceFor(p, room.stage));
      const score = scoreTotal(p);
      return `<div class="player-row"><div class="player-avatar">${escapeHtml((p.name || '?').slice(0,1).toUpperCase())}</div><div class="player-info"><strong>${escapeHtml(p.name)}${isYou?' <small style="display:inline;color:var(--cyan)">(YOU)</small>':''}${host?' <span class="host-tag">HOST</span>':''}</strong><small>${room.status === 'lobby' ? (host?'ARENA LEAD':'ENGINEER #'+String(idx+1).padStart(2,'0')) : (completed?'CHOICE LOCKED':'READY FOR ACTION')}</small></div><div class="player-points">${score} PTS</div></div>`;
    }).join('') || '<p class="rule-note">Waiting for players to join…</p>';
  }
  function renderRoom() {
    if (!room) return;
    showRoom(); $('roomCodeDisplay').textContent = room.code; $('roomTitle').innerHTML = room.status === 'lobby' ? 'Waiting for players<span class="gradient-text">.</span>' : room.status === 'finished' ? 'Championship over<span class="gradient-text">.</span>' : `Round ${String(room.stage).padStart(2,'0')}<span class="gradient-text">.</span>`;
    $('roomSubtitle').textContent = room.status === 'lobby' ? 'Share the code. Once two or more engineers are here, the host can start.' : room.status === 'finished' ? 'Final scores are locked by the game server. Queue another match when ready.' : 'Make your move. Your score is calculated on the game server and shared live.';
    $('roomEyebrow').textContent = room.status === 'lobby' ? 'ARENA LOBBY' : room.status === 'finished' ? 'RESULTS ARCHIVE' : `CHAMPIONSHIP / ROUND ${room.stage}`;
    renderPlayers();
    const lobby = room.status === 'lobby';
    $('waitingState').hidden = !lobby;
    $('challengeState').hidden = room.status !== 'playing';
    $('finishedState').hidden = room.status !== 'finished';
    $('lobbyControls').hidden = !lobby;
    const isHost = room.created_by === userId;
    $('startMatchBtn').hidden = !isHost;
    $('startMatchBtn').disabled = busy || players.length < 2 || players.length > 4;
    $('startMatchBtn').textContent = players.length < 2 ? 'WAITING FOR A RIVAL' : 'INITIALIZE CHAMPIONSHIP ↗';
    if (room.status === 'playing') renderChallenge(isHost);
    if (room.status === 'finished') renderFinal(isHost);
    if (room.status === 'lobby') {
      $('challengeState').hidden = true;
      $('waitingState').hidden = false;
    }
  }
  function challengeMarkup(stage) {
    if (stage === 1) return `<div class="challenge-content"><span class="section-index">SUPERVISED LEARNING / CLASSIFICATION</span><h2>Find the right model.</h2><p class="challenge-explain">A greenhouse sensor recorded these examples. Low moisture is labeled <strong>DRY</strong>; higher moisture is <strong>HEALTHY</strong>. For this tiny one-dimensional pattern, choose the simplest model that captures the boundary and generalizes well.</p><div class="dataset-strip"><div class="dataset-cell"><span>MOISTURE</span><b>10%</b><span>DRY</span></div><div class="dataset-cell"><span>MOISTURE</span><b>25%</b><span>DRY</span></div><div class="dataset-cell"><span>MOISTURE</span><b>60%</b><span>HEALTHY</span></div><div class="dataset-cell"><span>MOISTURE</span><b>80%</b><span>HEALTHY</span></div><div class="dataset-cell"><span>MOISTURE</span><b>95%</b><span>HEALTHY</span></div></div><p class="challenge-explain"><strong>Scoring:</strong> the server awards 100 points for the threshold classifier, 70 for nearest-neighbor, and 30 for a random guess.</p>${choiceButtons(stage)}</div>`;
    if (stage === 2) return `<div class="challenge-content"><span class="section-index">ML PIPELINE / DATA LEAKAGE</span><h2>Stop the leak.</h2><p class="challenge-explain">An engineer scales every row before splitting the dataset into training and test sets. The scaler has now used information from the test set. That makes evaluation less trustworthy. Pick the fix.</p><div class="dataset-strip"><div class="dataset-cell"><span>RAW DATA</span><b>100%</b><span>ALL ROWS</span></div><div class="dataset-cell"><span>TRAIN</span><b>80%</b><span>LEARN</span></div><div class="dataset-cell"><span>TEST</span><b>20%</b><span>UNSEEN</span></div></div><p class="challenge-explain"><strong>Scoring:</strong> a correct fix earns 100 points. Incorrect fixes earn 0.</p>${choiceButtons(stage)}</div>`;
    return `<div class="challenge-content"><span class="section-index">AUTONOMOUS AGENTS / STRATEGY SELECTION</span><h2>Deploy your agent.</h2><p class="challenge-explain">The arena's hidden condition changes each match. Pick an agent strategy and the server will run a deterministic seeded simulation. The strategy best matched to the environment has the highest base score; player scores cannot be typed in or edited.</p><div class="arena-preview"><div class="arena-grid"><span class="arena-hazard hazard-one"></span><span class="arena-hazard hazard-two"></span><span class="arena-energy energy-one">✦</span><span class="arena-energy energy-two">✦</span><span class="arena-energy energy-three">✦</span><div class="arena-agent agent-cyan">A</div><div class="arena-agent agent-violet">B</div><div class="arena-agent agent-amber">C</div><div class="arena-core">◎</div></div><div class="arena-caption"><span>SIMULATED FIELD</span><span>ENERGY / OBSTACLES / ADAPTATION</span></div></div><p class="challenge-explain"><strong>Scoring:</strong> performance ranges from 64–100 points based on the environment and your strategy.</p>${choiceButtons(stage)}</div>`;
  }
  function choiceButtons(stage) {
    const me = playerById(userId); const chosen = me ? choiceFor(me, stage) : null;
    return `<div class="choice-grid">${options[stage].map((opt, i) => `<button type="button" class="choice-card${chosen===opt.value?' selected':''}" data-choice="${opt.value}" data-submitted="${chosen?'true':'false'}" ${chosen || busy ? 'disabled':''}><span class="choice-index">${opt.index}</span><strong>${opt.title}</strong><small>${opt.desc}</small></button>`).join('')}</div>${chosen?`<p class="message" style="color:var(--cyan);margin-top:11px">CHOICE LOCKED · ${escapeHtml(options[stage].find(o=>o.value===chosen)?.title || chosen)} · ${pointsFor(me,stage)} PTS AWARDED BY SERVER</p>`:''}`;
  }
  function renderChallenge(isHost) {
    const stage = room.stage; $('stageNumber').textContent = stageMeta[stage]?.label || 'ROUND';
    const subCount = players.filter(p => Boolean(choiceFor(p, stage))).length;
    $('submissionCount').textContent = `${subCount} / ${players.length} submitted`;
    $('submissionDots').innerHTML = players.map(p => `<span class="submission-dot${choiceFor(p,stage)?' done':''}" title="${escapeHtml(p.name)}"></span>`).join('');
    $('stageStatus').innerHTML = subCount === players.length ? '<i></i> ALL CHOICES LOCKED' : '<i></i> CHOICES OPEN';
    $('challengeContent').innerHTML = challengeMarkup(stage);
    $('hostAdvanceWrap').hidden = !isHost;
    const ready = allSubmitted(stage);
    $('advanceStageBtn').disabled = busy || !ready;
    $('advanceStageBtn').textContent = stage < 3 ? `ADVANCE TO ROUND ${String(stage+1).padStart(2,'0')} ↗` : 'REVEAL CHAMPION ↗';
    $('advanceHint').textContent = ready ? 'All players submitted. The host can safely advance.' : 'Every player must submit a choice before the host can advance.';
  }
  function renderFinal(isHost) {
    const sorted = [...players].sort((a,b) => scoreTotal(b)-scoreTotal(a) || (b.stage3_score||0)-(a.stage3_score||0));
    const winner = room.winner_id ? playerById(room.winner_id) : null;
    $('winnerTitle').innerHTML = room.is_draw ? 'Perfectly matched<span class="gradient-text">.</span>' : `${escapeHtml(winner?.name || 'Arena champion')}<span class="gradient-text">.</span>`;
    $('winnerSubtitle').textContent = room.is_draw ? 'A draw. Your engineering strategies matched—run it back to break the tie.' : `${winner?.name || 'The champion'} wins the AI Engineering Championship with ${scoreTotal(winner || {})} points.`;
    $('finalLeaderboard').innerHTML = sorted.map((p, idx) => `<div class="finish-row"><div class="finish-rank">${String(idx+1).padStart(2,'0')}</div><div class="finish-name"><strong>${escapeHtml(p.name)}${p.player_id===room.winner_id?' ✦':''}${p.player_id===userId?' (YOU)':''}</strong><small>TRAIN ${p.stage1_score} / DEBUG ${p.stage2_score} / BATTLE ${p.stage3_score}</small></div><div class="finish-score">${scoreTotal(p)} <small style="font:8px var(--mono);color:#8092ae">PTS</small></div></div>`).join('');
    $('rematchBtn').hidden = !isHost; $('rematchBtn').disabled = busy;
  }
  async function submitChoice(choice) {
    if (!roomId || !room || room.status !== 'playing') return;
    setBusy(true);
    try {
      const result = await rpc('submit_stage_choice', {p_room_id:roomId,p_choice:choice});
      await refreshRoom(); showToast(`Choice locked. Server awarded ${result.points} points.`);
    } catch (error) { showToast(error.message); await refreshRoom(); }
    finally { setBusy(false); }
  }
  async function startMatch() {
    if (!roomId) return; setBusy(true);
    try { await rpc('start_match',{p_room_id:roomId}); await refreshRoom(); showToast('Championship initialized. Round 1 is live.'); }
    catch (error) { showToast(error.message); }
    finally { setBusy(false); }
  }
  async function advanceStage() {
    if (!roomId) return; setBusy(true);
    try {
      await rpc('advance_stage',{p_room_id:roomId}); await refreshRoom();
      if (room?.status === 'finished') showToast('Championship complete. Final scores are locked.');
      else showToast(`Round ${room?.stage} is live.`);
    } catch (error) { showToast(error.message); }
    finally { setBusy(false); }
  }
  async function rematch() {
    if (!roomId) return; setBusy(true);
    try { await rpc('restart_match',{p_room_id:roomId}); await refreshRoom(); showToast('Rematch lobby is open. Host can start when everyone is ready.'); }
    catch (error) { showToast(error.message); }
    finally { setBusy(false); }
  }
  async function leaveRoom() {
    setBusy(true);
    try { if (roomId && client) await rpc('leave_room',{p_room_id:roomId}); }
    catch (error) { showToast(error.message); }
    finally { clearRoomLocal(); showHome(); setBusy(false); }
  }
  function clearRoomLocal() {
    if (channel && client) client.removeChannel(channel);
    channel = null; clearInterval(refreshTimer); refreshTimer = null;
    roomId = null; roomCode = null; room = null; players = [];
    sessionStorage.removeItem('neuralArenaRoomId'); sessionStorage.removeItem('neuralArenaRoomCode');
  }
  async function copyCode() {
    if (!roomCode) return;
    try { await navigator.clipboard.writeText(roomCode); showToast('Room code copied. Send it to your friend.'); }
    catch { window.prompt('Copy this room code and send it to your friend:',roomCode); }
  }
  function restoreRoomHint() {
    const savedName = sessionStorage.getItem('neuralArenaName'); if (savedName) $('playerName').value = savedName;
    const savedCode = sessionStorage.getItem('neuralArenaRoomCode'); if (savedCode) $('roomCodeInput').value = savedCode;
  }
  async function reconnect() {
    if (!configured || !window.supabase) { $('setupNotice').hidden = false; $('connectionLabel').textContent = 'SETUP REQUIRED'; return; }
    $('connectionLabel').textContent = 'CONNECTING…';
    try {
      await ensureClient();
      const savedId = sessionStorage.getItem('neuralArenaRoomId');
      if (savedId) {
        roomId = savedId; roomCode = sessionStorage.getItem('neuralArenaRoomCode');
        const result = await client.from('neural_rooms').select('id').eq('id',roomId).maybeSingle();
        if (result.data) { await refreshRoom(); subscribeRoom(); showRoom(); return; }
        clearRoomLocal();
      }
      $('connectionLabel').textContent = 'SYSTEM ONLINE';
    } catch (error) {
      $('connectionLabel').textContent = 'OFFLINE';
      if (error.message.includes('Anonymous sign-in')) showToast(error.message);
      else console.warn('Neural Arena connection check:',error.message);
    }
  }

  $('createRoomBtn').addEventListener('click',createRoom);
  $('joinRoomBtn').addEventListener('click',joinRoom);
  $('roomCodeInput').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,6);});
  $('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
  $('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')createRoom();});
  $('startMatchBtn').addEventListener('click',startMatch);
  $('advanceStageBtn').addEventListener('click',advanceStage);
  $('rematchBtn').addEventListener('click',rematch);
  $('copyCodeBtn').addEventListener('click',copyCode);
  $('leaveRoomBtn').addEventListener('click',leaveRoom);
  $('finishLeaveBtn').addEventListener('click',leaveRoom);
  $('backHomeBtn').addEventListener('click',()=>{if(room)showToast('Use LEAVE ARENA to exit cleanly.');else showHome();});
  $('challengeContent').addEventListener('click',e=>{const button=e.target.closest('[data-choice]');if(button && !button.disabled)submitChoice(button.dataset.choice);});
  restoreRoomHint();
  if (!configured) $('setupNotice').hidden = false;
  else $('setupNotice').hidden = true;
  reconnect();
})();
