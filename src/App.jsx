import React, { useState, useEffect, useMemo } from 'react';
import { Volume2, Mic, RotateCcw, Trophy, Info, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';

// --- CONFIG & CONSTANTS ---
const PLAYERS_CONFIG = [
  { id: 0, team: 0, shape: 'square', colorClass: 'bg-blue-500', borderColor: 'border-blue-300', side: 'deuce' },
  { id: 1, team: 0, shape: 'circle', colorClass: 'bg-yellow-400', borderColor: 'border-yellow-200', side: 'ad' },
  { id: 2, team: 1, shape: 'triangle', colorClass: 'bg-red-500', borderColor: 'border-red-300', side: 'deuce' },
  { id: 3, team: 1, shape: 'diamond', colorClass: 'bg-green-500', borderColor: 'border-green-300', side: 'ad' },
];

const SCORE_STRINGS = ['Love', '15', '30', '40', 'Ad'];
const NAME_MODES = ['None', 'Initial', '2 Letters', 'Full Name'];

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

export default function App() {
  // --- STATE ---
  const [setupMode, setSetupMode] = useState(true);
  
  const [settings, setSettings] = useState({
    mode: 'singles', // 'singles' | 'doubles'
    umpireMode: true,
    callMode: true,
    nameModeIndex: 3, // Default to Full Name
    noAdScoring: false, // ITF alternative scoring
    playerNames: ['Sarah', 'Alex', 'John', 'Emma'],
  });

  const [state, setState] = useState({
    points: [0, 0],
    games: [0, 0],
    tiebreakPoints: [0, 0],
    isTiebreak: false,
    serveSide: 'deuce', // 'deuce' | 'ad'
    courtSide: 0,       // 0: Team 0 bottom, 1: Team 0 top
    serverIndex: 0,
    gameServerRotationIndex: 0, 
    servingOrder: [0, 2],
    history: [],
    pendingSideSwitch: false,
    matchWon: false,
    winnerTeamId: null,
    noAdReceiverChoice: null, // 'deuce' or 'ad' for the No-Ad deciding point
  });

  const startMatch = (e) => {
    e.preventDefault();
    const servingOrder = settings.mode === 'singles' ? [0, 2] : [0, 2, 1, 3];
    setState({
      ...state,
      points: [0, 0],
      games: [0, 0],
      tiebreakPoints: [0, 0],
      isTiebreak: false,
      serveSide: 'deuce',
      courtSide: 0,
      gameServerRotationIndex: 0,
      servingOrder,
      serverIndex: servingOrder[0],
      history: [],
      pendingSideSwitch: false,
      matchWon: false,
      winnerTeamId: null,
      noAdReceiverChoice: null,
    });
    setSetupMode(false);
  };

  const saveHistory = (currentState) => {
    const st = deepClone(currentState);
    delete st.history; 
    return st;
  };

  const handlePoint = (winningTeamId) => {
    if (state.pendingSideSwitch || state.matchWon) return;

    let nextState = deepClone(state);
    nextState.history.push(saveHistory(state));

    if (nextState.isTiebreak) {
      nextState.tiebreakPoints[winningTeamId]++;
      const t0 = nextState.tiebreakPoints[0];
      const t1 = nextState.tiebreakPoints[1];
      const totalPts = t0 + t1;

      if ((t0 >= 7 || t1 >= 7) && Math.abs(t0 - t1) >= 2) {
        winGame(nextState, winningTeamId);
      } else {
        nextState.serveSide = totalPts % 2 === 0 ? 'deuce' : 'ad';
        
        const rotations = Math.floor((totalPts + 1) / 2);
        const orderIdx = (nextState.gameServerRotationIndex + rotations) % nextState.servingOrder.length;
        nextState.serverIndex = nextState.servingOrder[orderIdx];

        if (totalPts % 6 === 0) {
          nextState.pendingSideSwitch = true;
        }
      }
    } else {
      let pts = nextState.points;
      let w = winningTeamId;
      let l = 1 - w;

      // No-Ad Scoring Rules Engine (ITF Appendix V)
      if (settings.noAdScoring) {
        if (pts[w] === 3 && pts[l] === 3) {
          // Deciding point is played, winner wins the game immediately
          winGame(nextState, w);
        } else if (pts[w] === 3) {
          winGame(nextState, w);
        } else {
          pts[w]++;
        }
      } else {
        // Standard Advantage Scoring Rules Engine (ITF Rule 5)
        if (pts[w] === 3 && pts[l] < 3) {
          winGame(nextState, w);
        } else if (pts[w] === 3 && pts[l] === 3) {
          pts[w] = 4; // Advantage In/Out
        } else if (pts[w] === 4 && pts[l] === 3) {
          winGame(nextState, w);
        } else if (pts[w] === 3 && pts[l] === 4) {
          pts[l] = 3; // Deuce
        } else {
          pts[w]++;
        }
      }

      if (!nextState.matchWon && pts[w] !== 0) {
        // Alternate serving side for next point
        nextState.serveSide = nextState.serveSide === 'deuce' ? 'ad' : 'deuce';
        nextState.noAdReceiverChoice = null; // Reset choice
      }
    }
    setState(nextState);
  };

  const winGame = (nextState, winningTeamId) => {
    nextState.games[winningTeamId]++;
    nextState.points = [0, 0];
    nextState.tiebreakPoints = [0, 0];
    nextState.serveSide = 'deuce';
    nextState.noAdReceiverChoice = null;

    const g0 = nextState.games[0];
    const g1 = nextState.games[1];
    
    if ((g0 >= 6 && g0 - g1 >= 2) || g0 === 7) {
      nextState.matchWon = true;
      nextState.winnerTeamId = 0;
      return;
    } else if ((g1 >= 6 && g1 - g0 >= 2) || g1 === 7) {
      nextState.matchWon = true;
      nextState.winnerTeamId = 1;
      return;
    }

    if (g0 === 6 && g1 === 6) {
      nextState.isTiebreak = true;
    } else {
      nextState.isTiebreak = false;
    }

    nextState.gameServerRotationIndex = (nextState.gameServerRotationIndex + 1) % nextState.servingOrder.length;
    nextState.serverIndex = nextState.servingOrder[nextState.gameServerRotationIndex];

    if ((g0 + g1) % 2 !== 0) {
      nextState.pendingSideSwitch = true;
    }
  };

  const handleUndo = () => {
    if (state.history.length === 0) return;
    const previousState = state.history[state.history.length - 1];
    previousState.history = state.history.slice(0, -1);
    setState(previousState);
  };

  const handleNoAdSideSelection = (side) => {
    setState(s => ({ ...s, noAdReceiverChoice: side, serveSide: side }));
  };

  // --- DERIVED DATA ---
  const activeData = useMemo(() => {
    if (setupMode) return null;
    const serverConf = PLAYERS_CONFIG[state.serverIndex];
    const serverName = settings.playerNames[serverConf.id];
    const serverTeamId = serverConf.team;
    const receiverTeamId = 1 - serverTeamId;
    
    // Choose receiver target based on selected side (particularly important for No-Ad deciding point)
    const activeSide = state.noAdReceiverChoice || state.serveSide;
    const receiverConf = PLAYERS_CONFIG.find(p => 
      p.team === receiverTeamId && 
      (settings.mode === 'singles' || p.side === activeSide)
    );
    const receiverName = settings.playerNames[receiverConf?.id || 2];

    const isNoAdDecidingPoint = settings.noAdScoring && state.points[0] === 3 && state.points[1] === 3;

    let stakes = "";
    if (state.isTiebreak) {
      const sp = state.tiebreakPoints[serverTeamId];
      const rp = state.tiebreakPoints[receiverTeamId];
      if (sp >= 6 && sp > rp) stakes = "Match Point!";
      else if (rp >= 6 && rp > sp) stakes = "Match Point!";
    } else {
      const sp = state.points[serverTeamId];
      const rp = state.points[receiverTeamId];
      const gS = state.games[serverTeamId];
      const gR = state.games[receiverTeamId];
      
      const isMatchPointPossibility = (gS === 5 && sp >= 3 && sp > rp) || (gR === 5 && rp >= 3 && rp > sp);
      
      if (isNoAdDecidingPoint) {
        stakes = "DECIDING POINT (ITF NO-AD)!";
      } else {
        if (sp === 3 && rp < 3 || sp === 4) stakes = isMatchPointPossibility ? "Match Point!" : "Game Point!";
        if (rp === 3 && sp < 3 || rp === 4) stakes = isMatchPointPossibility ? "Match Point!" : "Break Point!";
      }
    }

    let umpireText = `${serverName.toUpperCase()} is serving to ${receiverName.toUpperCase()}.`;
    if (state.isTiebreak) {
      umpireText += ` The tiebreak score is ${state.tiebreakPoints[serverTeamId]} to ${state.tiebreakPoints[receiverTeamId]}.`;
    } else if (isNoAdDecidingPoint) {
      umpireText = `Deciding Point! Receiver team must select receiving side. ${serverName.toUpperCase()} is serving.`;
    } else {
      umpireText += ` The score is ${SCORE_STRINGS[state.points[serverTeamId]]} to ${SCORE_STRINGS[state.points[receiverTeamId]]}.`;
    }

    let callText = "";
    if (state.isTiebreak) {
      callText = `${state.tiebreakPoints[serverTeamId]} - ${state.tiebreakPoints[receiverTeamId]}`;
    } else if (isNoAdDecidingPoint) {
      callText = "Deuce - Deciding Point!";
    } else {
      const sp = state.points[serverTeamId];
      const rp = state.points[receiverTeamId];
      if (sp === 0 && rp === 0) callText = "Love - All";
      else if (sp === 1 && rp === 1) callText = "15 - All";
      else if (sp === 2 && rp === 2) callText = "30 - All";
      else if (sp === 3 && rp === 3) callText = "Deuce!";
      else if (sp === 4) callText = "Ad-In!";
      else if (rp === 4) callText = "Ad-Out!";
      else callText = `${SCORE_STRINGS[sp]} - ${SCORE_STRINGS[rp]}`;
    }

    return { serverConf, receiverConf, umpireText, callText, stakes, serverName, receiverName, isNoAdDecidingPoint };
  }, [state, settings, setupMode]);

  const getPlayerPosition = (playerConf) => {
    const isTeam0 = playerConf.team === 0;
    const isBottom = (isTeam0 && state.courtSide === 0) || (!isTeam0 && state.courtSide === 1);
    
    const isDeuceSide = playerConf.side === 'deuce';
    const xBaseDeuce = isBottom ? 72 : 28;
    const xBaseAd = isBottom ? 28 : 72;
    
    let x = isDeuceSide ? xBaseDeuce : xBaseAd;
    let y = 50;

    const isActiveServer = playerConf.id === activeData?.serverConf?.id;
    const isActiveReceiver = playerConf.id === activeData?.receiverConf?.id;

    if (isActiveServer) {
      y = isBottom ? 95 : 5;
      x = state.serveSide === 'deuce' ? (isBottom ? 62 : 38) : (isBottom ? 38 : 62);
    } else if (isActiveReceiver) {
      y = isBottom ? 87 : 13;
      x = state.serveSide === 'deuce' ? (isBottom ? 62 : 38) : (isBottom ? 38 : 62);
    } else {
      const isServerPartner = playerConf.team === activeData?.serverConf?.team;
      if (isServerPartner) {
        y = isBottom ? 62 : 38; 
        x = state.serveSide === 'deuce' ? (isBottom ? 28 : 72) : (isBottom ? 72 : 28);
      } else {
        y = isBottom ? 77 : 23; 
        x = state.serveSide === 'deuce' ? (isBottom ? 28 : 72) : (isBottom ? 72 : 28);
      }
    }

    return { x, y };
  };

  const getFormattedName = (name, index) => {
    if (index === 0) return ""; // None
    if (index === 1) return name.charAt(0).toUpperCase(); // Initial
    if (index === 2) return name.substring(0, 2).toUpperCase(); // 2 Letters
    return name; // Full Name
  };

  const cycleNameMode = () => {
    setSettings(s => ({ ...s, nameModeIndex: (s.nameModeIndex + 1) % NAME_MODES.length }));
  };

  const getTeamName = (teamId) => {
    if (settings.mode === 'singles') return settings.playerNames[teamId === 0 ? 0 : 2];
    return `${settings.playerNames[teamId === 0 ? 0 : 2]} & ${settings.playerNames[teamId === 0 ? 1 : 3]}`;
  };

  // --- RENDERING SHAPES ---
  const renderShape = (shape, colorClass, border, name, sizeClass = "w-7 h-7", glow = false) => {
    const formattedName = getFormattedName(name, settings.nameModeIndex);
    const classes = `${sizeClass} ${colorClass} ${border} shadow-lg shadow-black/60 z-10 flex items-center justify-center transition-all duration-500 ease-in-out relative ${glow ? 'ring-4 ring-white/50' : ''}`;
    
    let element;
    if (shape === 'square') element = <div className={`${classes} border-2`} />;
    else if (shape === 'circle') element = <div className={`${classes} rounded-full border-2`} />;
    else if (shape === 'triangle') element = <div className={classes} style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />;
    else if (shape === 'diamond') element = <div className={`${classes} rotate-45 border`} />;

    // Determine if we should overlay inside the shape or render as a sub-pill
    const isShort = settings.nameModeIndex === 1 || settings.nameModeIndex === 2;
    const isFullName = settings.nameModeIndex === 3;

    return (
      <div className="relative flex flex-col items-center">
        {/* Base Shape */}
        {element}

        {/* Short Initials (1 or 2 letters): Rendered on top of the shape with z-20 */}
        {formattedName && isShort && (
          <span className="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-black text-slate-950 pointer-events-none drop-shadow-[0_1px_1.5px_rgba(255,255,255,0.95)]">
            {formattedName}
          </span>
        )}

        {/* Full Name: Rendered as a legible, anti-glare mini-pill right beneath the shape */}
        {formattedName && isFullName && (
          <span className="absolute top-full mt-1.5 z-20 bg-slate-950/90 text-white border border-slate-700/80 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide pointer-events-none whitespace-nowrap shadow-md">
            {formattedName}
          </span>
        )}
      </div>
    );
  };

  if (setupMode) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col p-6 items-center justify-center">
        <div className="w-full max-w-md bg-slate-800 p-6 rounded-3xl shadow-2xl space-y-6 border border-slate-700">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span className="bg-green-500 w-4 h-4 rounded-full animate-bounce"></span>
              TennisTutor
            </h1>
            <p className="text-slate-400 text-sm">Official ITF-Compliant Assistant</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Game Mode</label>
            <div className="flex bg-slate-950 p-1 rounded-xl">
              {['singles', 'doubles'].map(m => (
                <button
                  key={m}
                  type="button"
                  className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-lg transition ${settings.mode === m ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}
                  onClick={() => setSettings({ ...settings, mode: m })}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Section */}
          <div className="bg-slate-900/80 p-4 rounded-2xl space-y-3 border border-slate-700/50">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-white uppercase block">No-Ad Scoring</span>
                <span className="text-[10px] text-slate-400">ITF Deciding Point at 40-40</span>
              </div>
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded bg-slate-950 border-slate-700 accent-blue-600 cursor-pointer"
                checked={settings.noAdScoring} 
                onChange={(e) => setSettings({ ...settings, noAdScoring: e.target.checked })} 
              />
            </div>
          </div>

          <form onSubmit={startMatch} className="space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-400">Team 1</div>
              <div className="flex items-center gap-3">
                {renderShape('square', 'bg-blue-500', 'border-blue-300', settings.playerNames[0], 'w-8 h-8')}
                <input required className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={settings.playerNames[0]} onChange={(e) => { const n = [...settings.playerNames]; n[0] = e.target.value; setSettings({...settings, playerNames: n}); }} placeholder="Player Name" />
              </div>
              {settings.mode === 'doubles' && (
                <div className="flex items-center gap-3">
                  {renderShape('circle', 'bg-yellow-400', 'border-yellow-200', settings.playerNames[1], 'w-8 h-8')}
                  <input required className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm" value={settings.playerNames[1]} onChange={(e) => { const n = [...settings.playerNames]; n[1] = e.target.value; setSettings({...settings, playerNames: n}); }} placeholder="Player Name" />
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-700">
              <div className="text-xs font-bold uppercase tracking-wider text-red-400">Team 2</div>
              <div className="flex items-center gap-3">
                {renderShape('triangle', 'bg-red-500', 'border-red-300', settings.playerNames[2], 'w-8 h-8')}
                <input required className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm" value={settings.playerNames[2]} onChange={(e) => { const n = [...settings.playerNames]; n[2] = e.target.value; setSettings({...settings, playerNames: n}); }} placeholder="Player Name" />
              </div>
              {settings.mode === 'doubles' && (
                <div className="flex items-center gap-3">
                  {renderShape('diamond', 'bg-green-500', 'border-green-300', settings.playerNames[3], 'w-8 h-8')}
                  <input required className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm" value={settings.playerNames[3]} onChange={(e) => { const n = [...settings.playerNames]; n[3] = e.target.value; setSettings({...settings, playerNames: n}); }} placeholder="Player Name" />
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold text-base py-3.5 rounded-xl shadow-lg transition active:scale-95">
              START ITF MATCH
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col font-sans overflow-hidden select-none">
      
      {/* HEADER: Umpire, Call & Dynamic Name Mode Toggles */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center z-10 shrink-0">
        <div className="flex gap-2.5">
          <button onClick={() => setSettings(s => ({...s, umpireMode: !s.umpireMode}))} className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded transition ${settings.umpireMode ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>
            <Volume2 className="w-3.5 h-3.5" /> UMPIRE
          </button>
          <button onClick={() => setSettings(s => ({...s, callMode: !s.callMode}))} className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded transition ${settings.callMode ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>
            <Mic className="w-3.5 h-3.5" /> CALL
          </button>
          <button onClick={cycleNameMode} className="flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700">
            <Eye className="w-3.5 h-3.5 text-blue-400" /> NAMES: {NAME_MODES[settings.nameModeIndex]}
          </button>
        </div>
      </div>

      {/* TOP INSTRUCTION / SCORE ZONE */}
      <div className="px-4 py-2 min-h-[64px] flex flex-col justify-center bg-slate-950 shrink-0 relative">
        {settings.umpireMode && (
           <p className="text-slate-300 text-xs sm:text-sm leading-snug animate-fade-in pr-24">
             {activeData.umpireText}
             {activeData.stakes && <span className="block text-red-400 font-bold mt-0.5 animate-pulse">{activeData.stakes}</span>}
           </p>
        )}
        
        <div className="absolute right-4 top-2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono shadow-xl flex gap-3">
          <div className="flex flex-col items-center">
            <span className="text-slate-500 text-[10px]">GAMES</span>
            <span className="text-white font-bold">{state.games[0]} - {state.games[1]}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-slate-500 text-[10px]">POINTS</span>
            <span className="text-yellow-400 font-bold">
              {state.isTiebreak ? `${state.tiebreakPoints[0]}-${state.tiebreakPoints[1]}` : `${SCORE_STRINGS[state.points[0]]}-${SCORE_STRINGS[state.points[1]]}`}
            </span>
          </div>
        </div>
      </div>

      {/* NO-AD RECEIVER DECIDING SIDE SELECTOR (ITF Rule Compliance) */}
      {activeData.isNoAdDecidingPoint && !state.noAdReceiverChoice && (
        <div className="bg-blue-950/80 border-b border-blue-800/80 px-4 py-3 flex flex-col items-center gap-2 animate-fade-in z-20">
          <div className="flex items-center gap-1.5 text-xs text-blue-200">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span><strong>ITF Rule Deciding Point:</strong> Choose side to receive from:</span>
          </div>
          <div className="flex gap-2 w-full max-w-sm">
            <button onClick={() => handleNoAdSideSelection('deuce')} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition active:scale-95">
              RECEIVE DEUCE (Right)
            </button>
            <button onClick={() => handleNoAdSideSelection('ad')} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition active:scale-95">
              RECEIVE AD (Left)
            </button>
          </div>
        </div>
      )}

      {/* COURT VISUALIZER */}
      <div className="flex-1 relative bg-slate-900/50 p-2 py-4 overflow-hidden flex items-center justify-center">
        <div className="relative w-[92%] max-w-[340px] h-full max-h-[600px] bg-[#166534] border-4 border-white shadow-2xl mx-auto rounded-sm overflow-hidden">
          
          {/* Court Lines */}
          <div className="absolute top-0 bottom-0 left-[15%] right-[15%] border-l-2 border-r-2 border-white/80" />
          <div className="absolute top-[25%] bottom-[25%] left-[15%] right-[15%] border-t-2 border-b-2 border-white/80" />
          <div className="absolute top-[25%] bottom-[25%] left-[50%] border-l-2 border-white/80" />
          <div className="absolute top-0 h-2 left-[50%] border-l-2 border-white/80" />
          <div className="absolute bottom-0 h-2 left-[50%] border-l-2 border-white/80" />
          <div className="absolute top-[50%] left-0 right-0 border-t-4 border-slate-300/80 shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-0" />

          {/* Singles Alleys Dimming */}
          {settings.mode === 'singles' && (
            <>
              <div className="absolute top-0 bottom-0 left-0 w-[15%] bg-black/50 z-0 transition-opacity" />
              <div className="absolute top-0 bottom-0 right-0 w-[15%] bg-black/50 z-0 transition-opacity" />
            </>
          )}

          {/* Static Point-to-Point Serving Arrow with scalable Markers */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
             <defs>
               <marker id="serve-arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                 <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.75)" />
               </marker>
             </defs>
             {activeData?.serverConf && activeData?.receiverConf && (() => {
                const sPos = getPlayerPosition(activeData.serverConf);
                const rPos = getPlayerPosition(activeData.receiverConf);
                
                return (
                  <line 
                    x1={`${sPos.x}%`} y1={`${sPos.y}%`} 
                    x2={`${rPos.x}%`} y2={`${rPos.y}%`} 
                    stroke="rgba(255, 255, 255, 0.75)" 
                    strokeWidth="3" 
                    strokeLinecap="round"
                    markerEnd="url(#serve-arrow)"
                    className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                  />
                )
             })()}
          </svg>

          {/* Dynamic Player Avatars */}
          {PLAYERS_CONFIG.filter(p => settings.mode === 'doubles' || p.id === 0 || p.id === 2).map((player) => {
            const pos = getPlayerPosition(player);
            const isServer = player.id === activeData?.serverConf?.id;
            const name = settings.playerNames[player.id];
            
            return (
              <div 
                key={player.id} 
                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out z-10 flex flex-col items-center"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                {/* Speech Bubble / Call Mode Script */}
                {settings.callMode && isServer && (
                  <div className="absolute z-30 bottom-full mb-3.5 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xl whitespace-nowrap animate-bounce">
                    Say: {activeData.callText}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
                  </div>
                )}
                
                {renderShape(player.shape, player.colorClass, player.borderColor, name, isServer ? "w-8 h-8" : "w-6 h-6", isServer)}
              </div>
            );
          })}

        </div>
      </div>

      {/* THUMB ZONE CONTROLS - Streamlined purely for swift scoring */}
      <div className="h-[22vh] min-h-[140px] bg-slate-800 p-3.5 flex flex-col gap-3 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] shrink-0 pb-safe">
        
        {/* Row 1: Rally Point Winners */}
        <div className="flex gap-3 flex-1">
           <button 
             onClick={() => handlePoint(0)}
             disabled={state.pendingSideSwitch}
             className="flex-1 relative overflow-hidden rounded-2xl bg-slate-900 border-2 border-slate-750 shadow-xl active:scale-95 transition flex flex-col items-center justify-center gap-1 group"
           >
             <div className="absolute inset-0 bg-gradient-to-br from-blue-600/25 to-transparent group-active:from-blue-600/40" />
             <div className="flex gap-1 mb-0.5 z-10">
               {renderShape('square', 'bg-blue-500', 'border-blue-300', settings.playerNames[0], 'w-4 h-4')}
               {settings.mode === 'doubles' && renderShape('circle', 'bg-yellow-400', 'border-yellow-200', settings.playerNames[1], 'w-4 h-4')}
             </div>
             <span className="font-bold text-white text-xs sm:text-sm z-10 text-center leading-tight px-1">
               {getTeamName(0)}<br/>Won Point
             </span>
           </button>

           <button 
             onClick={() => handlePoint(1)}
             disabled={state.pendingSideSwitch}
             className="flex-1 relative overflow-hidden rounded-2xl bg-slate-900 border-2 border-slate-750 shadow-xl active:scale-95 transition flex flex-col items-center justify-center gap-1 group"
           >
             <div className="absolute inset-0 bg-gradient-to-br from-red-600/25 to-transparent group-active:from-red-600/40" />
             <div className="flex gap-1 mb-0.5 z-10">
               {renderShape('triangle', 'bg-red-500', 'border-red-300', settings.playerNames[2], 'w-4 h-4')}
               {settings.mode === 'doubles' && renderShape('diamond', 'bg-green-500', 'border-green-300', settings.playerNames[3], 'w-4 h-4')}
             </div>
             <span className="font-bold text-white text-xs sm:text-sm z-10 text-center leading-tight px-1">
               {getTeamName(1)}<br/>Won Point
             </span>
           </button>
        </div>

        {/* Row 2: Ergonomic Undo Panel */}
        <button 
          onClick={handleUndo} 
          disabled={state.history.length === 0} 
          className="w-full h-10 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-xl flex items-center justify-center gap-2 font-bold text-xs text-slate-300 transition shadow disabled:opacity-30 disabled:pointer-events-none"
        >
          <RotateCcw className="w-4 h-4" /> UNDO LAST POINT
        </button>
      </div>

      {/* ITF CHANGE ENDS OVERLAY (Odd game switch) */}
      {state.pendingSideSwitch && !state.matchWon && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-fade-in">
          <RotateCcw className="w-16 h-16 text-yellow-400 mb-6 animate-spin-slow" />
          <h2 className="text-3xl font-black text-white mb-2 text-center">ITF RULE 10: SWITCH ENDS!</h2>
          <p className="text-slate-300 text-center mb-8 max-w-xs text-sm">Odd game sum total reached ({state.games[0] + state.games[1]} games). Walk to the opposite side of the net.</p>
          <button 
            onClick={() => setState({...state, pendingSideSwitch: false, courtSide: 1 - state.courtSide})}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black text-base py-3.5 px-10 rounded-2xl shadow-lg transition active:scale-95"
          >
            SIDES CHANGED
          </button>
        </div>
      )}

      {/* ITF MATCH COMPLETED OVERLAY */}
      {state.matchWon && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
          <Trophy className="w-20 h-20 text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]" />
          <h2 className="text-3xl font-black text-white text-center mb-2 leading-tight">
            MATCH SET<br/>{getTeamName(state.winnerTeamId).toUpperCase()} WINS!
          </h2>
          <div className="text-xl font-mono text-slate-300 my-5 bg-slate-800 px-6 py-2.5 rounded-2xl border border-slate-700">
            Final Score: {state.games[0]} - {state.games[1]}
          </div>
          <button 
            onClick={() => setSetupMode(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-base py-3 px-10 rounded-xl shadow-xl transition active:scale-95"
          >
            NEW MATCH
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .animate-spin-slow { animation: spin 4s linear infinite; }
        .animate-fade-in { animation: fadeIn 0.25s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        .pb-safe { padding-bottom: max(12px, env-area-inset-bottom)); }
      `}} />
    </div>
  );
}
