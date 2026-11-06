import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home,
  User,
  PlusCircle,
  Activity,
  Mic,
  Send,
  TrendingUp,
  ActivitySquare,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Droplets,
  Moon,
  Apple,
  Flame,
  Edit3,
  Trash2,
  Settings,
  Goal,
  AudioLines,
  Sparkles,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  YAxis,
} from "recharts";

import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { Health } from "@capgo/capacitor-health";

const getStoredJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getTodayString = () => new Date().toLocaleDateString("en-CA");
const getPastDays = (numDays) => {
  const days = [];
  for (let i = 0; i <= numDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString("en-CA"));
  }
  return days;
};
const formatDateDisplay = (dateStr) => {
  if (dateStr === getTodayString()) return "Today";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const extractJSON = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      "Failed to parse AI response. Please try being more specific.",
      { cause: error },
    );
  }
};

const executeGeminiRequest = async (apiKeysString, payload) => {
  const keys = (apiKeysString || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (!keys.length) {
    throw new Error("Add at least one Gemini API key to continue.");
  }

  const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];

  let hitRateLimit = false;
  let lastErrorMsg = null;

  for (let key of keys) {
    for (let model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) return await response.json();
        if (response.status === 429) {
          hitRateLimit = true;
          continue;
        }

        const errData = await response.json().catch(() => ({}));
        lastErrorMsg = `API Error (${response.status}): ${
          errData.error?.message || "Invalid Request"
        }`;
        if (response.status === 400) throw new Error(lastErrorMsg);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastErrorMsg = message;
        if (message.includes("API Error (400)")) {
          throw new Error(message, { cause: error });
        }
      }
    }
  }

  if (hitRateLimit)
    throw new Error("API rate limit exceeded. Please wait a moment.");
  throw new Error(lastErrorMsg || "Connection to AI failed.");
};

function BrandLogo({ size = "md", badge = null, className = "" }) {
  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-4xl",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`${textSizes[size] || textSizes.md} font-black tracking-tight font-sans leading-none`}
      >
        <span className="text-white">e</span>
        <span className="text-[#dc143c]">AZ</span>
        <span className="text-white">fit</span>
      </span>
      {badge && (
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#dc143c]/10 text-[#dc143c] border border-[#dc143c]/20 uppercase tracking-widest leading-none">
          {badge}
        </span>
      )}
    </div>
  );
}

const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const webRecRef = useRef(null);

  const startListening = async (onResult, onStop) => {
    try {
      if (Capacitor.isNativePlatform()) {
        const check = await SpeechRecognition.checkPermissions();
        if (check.speechRecognition !== "granted") {
          const req = await SpeechRecognition.requestPermissions();
          if (req.speechRecognition !== "granted") {
            throw new Error("Microphone permission denied.");
          }
        }

        await SpeechRecognition.removeAllListeners();

        await SpeechRecognition.addListener("partialResults", (data) => {
          if (data.matches && data.matches.length > 0) {
            onResult(data.matches[0]);
          }
        });

        await SpeechRecognition.addListener("listeningState", (data) => {
          if (data.status === "stopped") {
            setIsListening(false);
            if (onStop) onStop();
          }
        });

        setIsListening(true);
        const res = await SpeechRecognition.start({
          language: "en-IN",
          maxResults: 1,
          prompt: "What did you eat?",
          partialResults: true,
          popup: false,
        });

        if (res && res.matches && res.matches.length > 0) {
          onResult(res.matches[0]);
        }
      } else {
        const SpeechRec =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
          throw new Error("Speech recognition is not supported in this browser.");
        }

        const recognition = new SpeechRec();
        recognition.lang = "en-IN";
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("");
          onResult(transcript);
        };

        recognition.onerror = () => {
          setIsListening(false);
          if (onStop) onStop();
        };

        recognition.onend = () => {
          setIsListening(false);
          if (onStop) onStop();
        };

        webRecRef.current = recognition;
        recognition.start();
        setIsListening(true);
      }
    } catch (err) {
      setIsListening(false);
      throw err;
    }
  };

  const stopListening = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await SpeechRecognition.stop();
      } else if (webRecRef.current) {
        webRecRef.current.stop();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsListening(false);
    }
  };

  return { isListening, startListening, stopListening };
};

const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    hasSupport: typeof window !== "undefined" && !!window.speechSynthesis,
  };
};

export default function App() {
  const [geminiApiKey, setGeminiApiKey] = useState(
    localStorage.getItem("gemini_api_key") || "",
  );
  const [areKeysValid, setAreKeysValid] = useState(
    Boolean(localStorage.getItem("gemini_api_key")),
  );
  const [profile, setProfile] = useState(getStoredJson("eazfit_profile", null));
  const [appData, setAppData] = useState(getStoredJson("eazfit_data", {}));

  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [notification, setNotification] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [manualEntryModal, setManualEntryModal] = useState(null);

  useEffect(() => {
    const initData = () => {
      const storedData = JSON.parse(localStorage.getItem("eazfit_data")) || {};
      const validDays = getPastDays(7);
      let prunedData = {};
      let hasChanges = false;

      Object.keys(storedData).forEach((dateKey) => {
        if (validDays.includes(dateKey)) {
          let dayObj = { ...storedData[dateKey] };

          if (dayObj.metrics) {
            if (dayObj.metrics.steps !== undefined) {
              dayObj.metrics.manualSteps =
                (dayObj.metrics.manualSteps || 0) + dayObj.metrics.steps;
              delete dayObj.metrics.steps;
              hasChanges = true;
            }
            if (dayObj.metrics.sleep !== undefined) {
              dayObj.metrics.manualSleep =
                (dayObj.metrics.manualSleep || 0) + dayObj.metrics.sleep;
              delete dayObj.metrics.sleep;
              hasChanges = true;
            }
          }
          prunedData[dateKey] = dayObj;
        } else {
          hasChanges = true;
        }
      });

      const today = getTodayString();
      if (!prunedData[today]) {
        prunedData[today] = {
          dailyLog: [],
          metrics: {
            nativeSteps: 0,
            manualSteps: 0,
            nativeSleep: 0,
            manualSleep: 0,
            water: 0,
          },
        };
        hasChanges = true;
      }

      setAppData(prunedData);
      if (hasChanges)
        localStorage.setItem("eazfit_data", JSON.stringify(prunedData));
    };
    initData();
  }, []);

  const updateMetrics = useCallback(
    (newMetricsFunc) => {
      setAppData((prev) => {
        const dayData = prev[selectedDate] || {
          dailyLog: [],
          metrics: {
            nativeSteps: 0,
            manualSteps: 0,
            nativeSleep: 0,
            manualSleep: 0,
            water: 0,
          },
        };
        const updated = newMetricsFunc(dayData.metrics || {});
        return { ...prev, [selectedDate]: { ...dayData, metrics: updated } };
      });
    },
    [selectedDate],
  );

  useEffect(() => {
    const syncNativeHealth = async () => {
      try {
        if (typeof window !== "undefined" && window.Capacitor) {
          const isAvailable = await Health.isAvailable();
          if (isAvailable.available) {
            await Health.requestAuthorization([
              { read: ["steps", "sleep"] },
            ]);
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            const stepsData = await Health.queryAggregated({
              startDate: startOfDay.toISOString(),
              endDate: endOfDay.toISOString(),
              dataType: "steps",
              bucket: "day",
            });
            const sleepData = await Health.queryAggregated({
              startDate: startOfDay.toISOString(),
              endDate: endOfDay.toISOString(),
              dataType: "sleep",
              bucket: "day",
            });

            const nativeSteps = stepsData?.value || 0;
            const nativeSleep = sleepData?.value
              ? Math.round((sleepData.value / 3600) * 10) / 10
              : 0;

            updateMetrics((prev) => ({
              ...prev,
              nativeSteps,
              nativeSleep,
            }));
          }
        }
      } catch (e) {
        console.warn("Health sync skipped:", e.message);
      }
    };
    syncNativeHealth();
  }, [selectedDate, updateMetrics]);

  useEffect(() => {
    localStorage.setItem("eazfit_data", JSON.stringify(appData));
  }, [appData]);

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const currentDayData = appData[selectedDate] || {
    dailyLog: [],
    metrics: {
      nativeSteps: 0,
      manualSteps: 0,
      nativeSleep: 0,
      manualSleep: 0,
      water: 0,
    },
  };

  const totals = currentDayData.dailyLog.reduce(
    (acc, curr) => ({
      calories: acc.calories + (Number(curr.calories) || 0),
      protein: acc.protein + (Number(curr.protein) || 0),
      carbs: acc.carbs + (Number(curr.carbs) || 0),
      fats: acc.fats + (Number(curr.fats) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );

  const addFoodLog = (item) => {
    setAppData((prev) => {
      const dayData = prev[selectedDate] || {
        dailyLog: [],
        metrics: {
          nativeSteps: 0,
          manualSteps: 0,
          nativeSleep: 0,
          manualSleep: 0,
          water: 0,
        },
      };
      return {
        ...prev,
        [selectedDate]: {
          ...dayData,
          dailyLog: [item, ...dayData.dailyLog],
        },
      };
    });
  };

  const updateFoodLog = (updatedItem) => {
    setAppData((prev) => {
      const dayData = prev[selectedDate] || {
        dailyLog: [],
        metrics: {
          nativeSteps: 0,
          manualSteps: 0,
          nativeSleep: 0,
          manualSleep: 0,
          water: 0,
        },
      };
      const newLogs = dayData.dailyLog.map((l) =>
        l.id === updatedItem.id ? updatedItem : l,
      );
      return { ...prev, [selectedDate]: { ...dayData, dailyLog: newLogs } };
    });
  };

  const deleteFoodLog = (logId) => {
    setAppData((prev) => {
      const dayData = prev[selectedDate] || {
        dailyLog: [],
        metrics: {
          nativeSteps: 0,
          manualSteps: 0,
          nativeSleep: 0,
          manualSleep: 0,
          water: 0,
        },
      };
      const newLogs = dayData.dailyLog.filter((l) => l.id !== logId);
      return { ...prev, [selectedDate]: { ...dayData, dailyLog: newLogs } };
    });
  };

  const handleSaveApiKey = (gemini) => {
    const cleanedGemini = (gemini || "").trim();

    localStorage.setItem("gemini_api_key", cleanedGemini);
    setGeminiApiKey(cleanedGemini);
    setAreKeysValid(Boolean(cleanedGemini));
    showNotification("API Key secured.");
  };

  if (!areKeysValid) return <SetupView onSave={handleSaveApiKey} />;
  if (!profile)
    return (
      <OnboardingView
        onComplete={(p) => {
          localStorage.setItem("eazfit_profile", JSON.stringify(p));
          setProfile(p);
          showNotification("Profile established.");
        }}
      />
    );

  return (
    <div className="h-screen w-full bg-black text-zinc-100 font-sans relative overflow-hidden flex flex-col items-center select-none pt-safe pb-safe">
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#dc143c]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {notification && (
        <div className="fixed top-6 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4 transition-all">
          <div
            className={`flex items-center gap-2.5 px-5 py-3 rounded-full shadow-2xl border backdrop-blur-2xl ${
              notification.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-200 shadow-red-900/20"
                : "bg-[#dc143c]/10 border-[#dc143c]/30 text-rose-200 shadow-rose-950/20"
            } animate-in slide-in-from-top-6 fade-in duration-300 zoom-in-95`}
          >
            {notification.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#dc143c]" />
            )}
            <span className="text-xs font-bold tracking-wide">
              {notification.msg}
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto w-full max-w-md relative z-10 custom-scrollbar bg-black/40 shadow-2xl border-x border-white/5 pb-32 flex flex-col">
        <header className="sticky top-0 z-40 bg-black/85 backdrop-blur-xl border-b border-white/5 px-5 py-3.5 flex items-center justify-between shrink-0">
          <BrandLogo size="md" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("profile")}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-xs font-black text-white hover:border-[#dc143c]/40 active:scale-95 transition-all shadow-md"
              title="Profile"
            >
              {profile?.name ? profile.name[0].toUpperCase() : "U"}
            </button>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <DashboardView
            totals={totals}
            profile={profile}
            metrics={currentDayData.metrics}
            dailyLog={currentDayData.dailyLog}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onSelectLog={setSelectedLog}
            setManualEntryModal={setManualEntryModal}
            setActiveTab={setActiveTab}
            onQuickAddWater={() => {
              updateMetrics((p) => ({ ...p, water: (p.water || 0) + 250 }));
              showNotification("+250ml Water Added");
            }}
          />
        )}
        {activeTab === "log" && (
          <div className="p-4 flex-1 flex flex-col">
            <LogFoodView
              geminiApiKey={geminiApiKey}
              profile={profile}
              selectedDate={selectedDate}
              onSuccess={(parsed) => {
                addFoodLog({ ...parsed, id: Date.now() });
                setActiveTab("dashboard");
                if (parsed.transcript) {
                  showNotification(`Logged: "${parsed.transcript}"`);
                } else {
                  showNotification("Meal logged successfully.");
                }
              }}
            />
          </div>
        )}
        {activeTab === "stats" && (
          <div className="p-4 flex-1 flex flex-col">
            <StatsView appData={appData} />
          </div>
        )}
        {activeTab === "coach" && (
          <div className="p-4 flex-1 flex flex-col">
            <CoachView
              appData={appData}
              profile={profile}
              apiKey={geminiApiKey}
              currentDate={selectedDate}
            />
          </div>
        )}
        {activeTab === "profile" && (
          <div className="p-4 flex-1 flex flex-col">
            <ProfileView
              profile={profile}
              setProfile={(p) => {
                setProfile(p);
                localStorage.setItem("eazfit_profile", JSON.stringify(p));
              }}
              geminiApiKey={geminiApiKey}
              onSaveApiKey={handleSaveApiKey}
              onSave={() => showNotification("Configuration saved.")}
            />
          </div>
        )}
      </main>

      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onUpdate={(updated) => {
            updateFoodLog(updated);
            setSelectedLog(null);
            showNotification("Log updated");
          }}
          onDelete={(id) => {
            deleteFoodLog(id);
            setSelectedLog(null);
            showNotification("Log deleted");
          }}
        />
      )}

      {manualEntryModal && (
        <ManualEntryModal
          type={
            manualEntryModal === "manualSteps"
              ? "steps"
              : manualEntryModal === "manualSleep"
              ? "sleep"
              : manualEntryModal
          }
          onClose={() => setManualEntryModal(null)}
          onSave={(val) => {
            updateMetrics((prev) => ({
              ...prev,
              [manualEntryModal]: (prev[manualEntryModal] || 0) + val,
            }));
            showNotification("Metrics updated");
          }}
        />
      )}

      <div
        className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none px-4"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <nav className="w-full max-w-sm bg-[#09090b]/95 backdrop-blur-2xl border border-white/10 p-2 rounded-full shadow-[0_20px_45px_-10px_rgba(0,0,0,0.85)] flex justify-between items-center pointer-events-auto">
          <TabButton
            icon={<Home />}
            label="Home"
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
          />
          <TabButton
            icon={<TrendingUp />}
            label="Stats"
            active={activeTab === "stats"}
            onClick={() => setActiveTab("stats")}
          />

          <div className="px-1">
            <button
              onClick={() => setActiveTab("log")}
              className="bg-[#dc143c] text-white p-3.5 rounded-full shadow-[0_0_20px_rgba(220,20,60,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center relative overflow-hidden group border border-rose-400/30"
              title="Log Meal"
            >
              <PlusCircle className="w-6 h-6 stroke-[2.5] relative z-10" />
            </button>
          </div>

          <TabButton
            icon={<Activity />}
            label="Coach"
            active={activeTab === "coach"}
            onClick={() => setActiveTab("coach")}
          />
          <TabButton
            icon={<User />}
            label="Profile"
            active={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
          />
        </nav>
      </div>
    </div>
  );
}

function DashboardView({
  totals,
  profile,
  metrics,
  dailyLog,
  selectedDate,
  setSelectedDate,
  onSelectLog,
  setManualEntryModal,
  setActiveTab,
  onQuickAddWater,
}) {
  const calsRemaining = Math.max(0, profile.goals.calories - totals.calories);
  const calsOver = Math.max(0, totals.calories - profile.goals.calories);
  const percentCals = Math.min(
    100,
    (totals.calories / profile.goals.calories) * 100,
  );

  const totalSteps = (metrics.nativeSteps || 0) + (metrics.manualSteps || 0);
  const totalSleep = (metrics.nativeSleep || 0) + (metrics.manualSleep || 0);

  const mealOrder = ["breakfast", "lunch", "snack", "dinner"];
  const mealGroups = { breakfast: [], lunch: [], snack: [], dinner: [] };

  dailyLog.forEach((log) => {
    const type = log.mealType?.toLowerCase() || "snack";
    if (mealGroups[type]) mealGroups[type].push(log);
    else mealGroups.snack.push(log);
  });

  const pastDays = getPastDays(6);
  const isToday = selectedDate === getTodayString();

  return (
    <div className="animate-in fade-in duration-500 relative pb-6">
      <div className="sticky top-[57px] z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 py-3 px-4 flex gap-2 overflow-x-auto custom-scrollbar shadow-sm">
        {pastDays.map((dateStr) => {
          const isSelected = selectedDate === dateStr;
          const isDayToday = dateStr === getTodayString();
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-tight transition-all active:scale-95 ${
                isSelected
                  ? "bg-[#dc143c] text-white shadow-[0_0_15px_rgba(220,20,60,0.3)]"
                  : "bg-[#121214] text-zinc-400 border border-white/5 hover:border-white/20"
              }`}
            >
              {isDayToday ? "Today" : formatDateDisplay(dateStr)}
            </button>
          );
        })}
      </div>

      <div className="px-5 pt-5 pb-2">
        <h2 className="text-2xl font-black tracking-tight text-white capitalize">
          Hi, {profile.name || "there"}
        </h2>
        <p className="text-xs text-[#dc143c] font-bold uppercase tracking-widest mt-0.5 font-mono">
          {isToday ? "Today's Meals & Nutrition" : `Intake for ${formatDateDisplay(selectedDate)}`}
        </p>
      </div>

      <div className="px-5 space-y-4 pt-2">
        <div className="bg-[#121214] border border-white/5 rounded-[32px] p-6 relative overflow-hidden flex items-center justify-between shadow-xl">
          <div
            className={`absolute top-[-20%] right-[-10%] w-40 h-40 rounded-full blur-[70px] ${
              calsOver > 0 ? "bg-red-500/20" : "bg-[#dc143c]/15"
            }`}
          />

          <div className="space-y-1 relative z-10">
            <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Flame
                className={`w-3.5 h-3.5 ${
                  calsOver > 0 ? "text-red-500" : "text-[#dc143c]"
                }`}
              />
              {calsOver > 0 ? "Over Budget" : "Energy Remaining"}
            </p>
            <h3
              className={`text-5xl font-black tracking-tighter font-mono ${
                calsOver > 0 ? "text-red-400" : "text-white"
              }`}
            >
              {calsOver > 0 ? calsOver.toLocaleString() : calsRemaining.toLocaleString()}
            </h3>
            <p className="text-xs text-zinc-400 font-semibold tracking-tight">
              kcal of {profile.goals.calories.toLocaleString()} goal
            </p>
          </div>

          <div className="w-24 h-24 relative z-10 shrink-0">
            <svg
              viewBox="0 0 36 36"
              className="w-full h-full transform -rotate-90 drop-shadow-lg"
            >
              <path
                d="M18 2 a 16 16 0 0 1 0 32 a 16 16 0 0 1 0 -32"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M18 2 a 16 16 0 0 1 0 32 a 16 16 0 0 1 0 -32"
                fill="none"
                stroke={calsOver > 0 ? "#ef4444" : "#dc143c"}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${percentCals}, 100`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-black tracking-tight font-mono text-white">
                {Math.round(percentCals)}%
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MacroCard
            title="Protein"
            current={totals.protein}
            max={profile.goals.protein}
            color="bg-[#dc143c]"
          />
          <MacroCard
            title="Carbs"
            current={totals.carbs}
            max={profile.goals.carbs}
            color="bg-blue-500"
          />
          <MacroCard
            title="Fats"
            current={totals.fats}
            max={profile.goals.fats}
            color="bg-amber-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <IntegrationCard
            icon={<Droplets className="w-5 h-5 text-cyan-400" />}
            label="Water"
            value={metrics.water || 0}
            goal={profile.goals.water}
            unit="ml"
            onAction={() => setManualEntryModal("water")}
            onQuickAction={onQuickAddWater}
            bg="bg-cyan-400/10"
          />
          <IntegrationCard
            icon={<Moon className="w-5 h-5 text-indigo-400" />}
            label="Sleep"
            value={totalSleep}
            goal={profile.goals.sleep}
            unit="h"
            onAction={() => setManualEntryModal("manualSleep")}
            bg="bg-indigo-400/10"
          />
        </div>
        <IntegrationCard
          icon={<Activity className="w-5 h-5 text-rose-400" />}
          label="Steps"
          value={totalSteps}
          goal={profile.goals.steps}
          unit=" steps"
          onAction={() => setManualEntryModal("manualSteps")}
          bg="bg-rose-400/10"
        />

        <div className="pt-4">
          <div className="flex justify-between items-end mb-4 px-1">
            <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-400 font-mono">
              Logged Meals
            </h3>
            <span className="text-[11px] font-bold text-zinc-500 font-mono">
              {totals.calories.toLocaleString()} kcal logged
            </span>
          </div>

          {dailyLog.length === 0 ? (
            <div className="bg-[#121214] border border-white/5 rounded-[28px] p-8 text-center flex flex-col items-center shadow-lg">
              <div className="w-14 h-14 bg-[#dc143c]/10 border border-[#dc143c]/20 rounded-2xl flex items-center justify-center mb-3">
                <Apple className="w-7 h-7 text-[#dc143c]" />
              </div>
              <p className="text-white text-base font-bold tracking-tight mb-1">
                No Meals Logged Yet
              </p>
              <p className="text-zinc-500 text-xs font-medium mb-4 max-w-xs">
                Tap below or hit the microphone button to record your intake.
              </p>
              <button
                onClick={() => setActiveTab("log")}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-full border border-white/10 transition-colors"
              >
                Log Meal Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {mealOrder.map((meal) => {
                const logs = mealGroups[meal];
                if (logs.length === 0) return null;
                const mealCals = logs.reduce(
                  (sum, l) => sum + (Number(l.calories) || 0),
                  0,
                );
                return (
                  <div
                    key={meal}
                    className="space-y-2 bg-[#121214]/60 border border-white/5 p-3 rounded-[24px]"
                  >
                    <div className="flex justify-between items-center px-2 pt-1 pb-1">
                      <h4 className="font-bold text-sm capitalize text-white tracking-tight">
                        {meal}
                      </h4>
                      <span className="text-[11px] font-mono font-bold text-[#dc143c]">
                        {mealCals} kcal
                      </span>
                    </div>
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        onClick={() => onSelectLog(log)}
                        className="bg-[#1a1a1d] border border-white/5 rounded-[18px] p-4 flex justify-between items-center cursor-pointer hover:border-[#dc143c]/30 active:scale-[0.99] transition-all shadow-md"
                      >
                        <div>
                          <p className="text-sm font-bold text-white capitalize leading-tight">
                            {log.foodName}
                          </p>
                          <div className="flex gap-2.5 text-[10px] text-zinc-400 font-mono font-bold mt-1">
                            <span>P: {log.protein}g</span>
                            <span>C: {log.carbs}g</span>
                            <span>F: {log.fats}g</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-white font-mono">
                            {log.calories}
                          </span>
                          <span className="text-[10px] text-zinc-500 ml-1">
                            kcal
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogFoodView({
  geminiApiKey,
  profile,
  selectedDate,
  onSuccess,
}) {
  const [textInput, setTextInput] = useState("");
  const [statusState, setStatusState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [autoSendCountdown, setAutoSendCountdown] = useState(0);

  const countdownIntervalRef = useRef(null);
  const textInputRef = useRef(textInput);

  useEffect(() => {
    textInputRef.current = textInput;
  }, [textInput]);

  const { isListening, startListening, stopListening } = useSpeechRecognition();

  const cancelAutoSend = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoSendCountdown(0);
  }, []);

  useEffect(() => {
    return cancelAutoSend;
  }, [cancelAutoSend]);

  const handleTextChange = (e) => {
    setTextInput(e.target.value);
    cancelAutoSend();
  };

  const triggerAutoSend = () => {
    cancelAutoSend();
    setAutoSendCountdown(8);
    countdownIntervalRef.current = setInterval(() => {
      setAutoSendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          executeTextAnalysis();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const executeTextAnalysis = async () => {
    const textToAnalyze = textInputRef.current;
    if (!textToAnalyze.trim()) return;

    cancelAutoSend();
    setStatusState("analyzing");

    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `User: ${profile.name}. Profile: ${
                  profile.dietType
                }, Allergies: ${profile.allergies}. 
Analyze this food entry captured via voice or text: "${textToAnalyze}". Current time is ${new Date().toLocaleTimeString()}.
The entry was captured using Indian English speech recognition and may contain phonetic misspellings or English approximations of Indian dishes, regional foods, Hindi words, or traditional serving units (such as roti, chapati, dal, katori, sabzi, paneer, paratha, idli, dosa, poha, upma, curd, chaas, biryani).
Correct any phonetic or transcription misrecognitions, infer the intended Indian or international food items and portion sizes accurately.
Return ONLY valid JSON with this exact structure: 
{"foodName": "string", "calories": number, "protein": number, "carbs": number, "fats": number, "confidence": "high/low", "mealType": "breakfast|lunch|snack|dinner", "transcript": "${textToAnalyze}"}`,
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      };
      const data = await executeGeminiRequest(geminiApiKey, payload);
      onSuccess(extractJSON(data.candidates[0].content.parts[0].text));
    } catch (error) {
      setErrorMessage(error.message);
      setStatusState("error");
    }
  };

  const handleVoiceRecord = async () => {
    if (isListening) {
      await stopListening();
      if (textInputRef.current.trim()) {
        triggerAutoSend();
      }
    } else {
      cancelAutoSend();
      try {
        await startListening(
          (transcript) => {
            setTextInput(transcript);
          },
          () => {
            if (textInputRef.current.trim()) {
              triggerAutoSend();
            }
          }
        );
      } catch (err) {
        setErrorMessage(err.message);
        setStatusState("error");
      }
    }
  };

  const quickChips = [
    "2 Roti with Dal",
    "Paneer Bhurji & 2 Roti",
    "Oatmeal Bowl",
    "3 Idli with Sambar",
    "1 Cup Masala Chai",
    "Chicken Rice Bowl",
  ];

  if (statusState === "analyzing")
    return (
      <AILoadingState text="Gemini Macro Analysis..." />
    );

  if (statusState === "error")
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 h-full">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h3 className="text-2xl font-black mb-2 tracking-tight">
          Processing Failed
        </h3>
        <p className="text-sm text-zinc-400 font-medium mb-10 leading-relaxed max-w-xs break-words">
          {errorMessage}
        </p>
        <button
          onClick={() => setStatusState("idle")}
          className="bg-white text-black font-bold py-4 px-10 rounded-full active:scale-95 transition-all shadow-lg shadow-white/10"
        >
          Retry Entry
        </button>
      </div>
    );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col pt-4 pb-4">
      <div className="mb-4 px-2">
        <h2 className="text-2xl font-black tracking-tight">Log Entry</h2>
        <p className="text-[#dc143c] text-xs font-mono font-bold tracking-widest uppercase mt-0.5">
          For {formatDateDisplay(selectedDate)}
        </p>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-[32px] p-5 flex-1 flex flex-col shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#dc143c] to-rose-600 opacity-30" />

        <textarea
          value={textInput}
          onChange={handleTextChange}
          placeholder="Speak or type your meal (e.g., 2 rotis with paneer bhurji and curd)..."
          className="w-full flex-1 bg-transparent text-white placeholder-zinc-600 focus:outline-none resize-none text-xl font-bold leading-relaxed tracking-tight custom-scrollbar min-h-[140px]"
          disabled={isListening}
        />

        <div className="pt-2 pb-3 flex gap-2 overflow-x-auto custom-scrollbar border-t border-white/5">
          {quickChips.map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setTextInput(chip);
                cancelAutoSend();
              }}
              className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] font-semibold border border-white/5 transition-colors active:scale-95"
            >
              + {chip}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center mt-3 pt-4 border-t border-white/5 relative h-16">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-zinc-500 w-1/3">
            {isListening ? "Listening (en-IN)..." : "Voice / Text"}
          </span>

          <div className="absolute left-1/2 -translate-x-1/2 top-[-20px]">
            <button
              onClick={handleVoiceRecord}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                isListening
                  ? "bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)] animate-pulse scale-110 border-4 border-red-400/40"
                  : "bg-[#dc143c] shadow-[0_0_25px_rgba(220,20,60,0.3)] border border-rose-400/40 hover:scale-105 active:scale-95 text-black"
              }`}
              title={isListening ? "Tap to Stop" : "Tap to Speak"}
            >
              {isListening ? (
                <AudioLines className="w-7 h-7 text-white animate-pulse" />
              ) : (
                <Mic className="w-7 h-7 stroke-[2.5]" />
              )}
            </button>
            {isListening && (
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-red-400 font-bold whitespace-nowrap animate-bounce">
                Tap to Stop
              </span>
            )}
          </div>

          <div className="w-1/3 flex justify-end flex-col items-end gap-1">
            <button
              onClick={executeTextAnalysis}
              disabled={!textInput.trim() || isListening}
              className="bg-[#dc143c] text-white px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(220,20,60,0.25)] relative overflow-hidden min-w-[96px]"
            >
              {autoSendCountdown > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-white/40 transition-all duration-1000 ease-linear"
                  style={{ width: `${(autoSendCountdown / 8) * 100}%` }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center whitespace-nowrap">
                {autoSendCountdown > 0
                  ? `(${autoSendCountdown}s)`
                  : "Analyze"}
              </span>
            </button>
            {autoSendCountdown > 0 && (
              <span className="text-[8px] text-zinc-500 animate-pulse uppercase tracking-wider font-mono">
                Type to cancel
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoachView({ appData, profile, apiKey, currentDate }) {
  const [briefing, setBriefing] = useState(null);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const { speak, stop, isSpeaking, hasSupport: ttsSupport } = useTextToSpeech();

  const fetchBriefing = useCallback(async () => {
    const cacheKey = `eazfit_briefing_${currentDate}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setBriefing(JSON.parse(cached));
      return;
    }

    setLoading(true);
    try {
      const days = getPastDays(2).reverse();
      let ctx = days
        .map((d) => {
          const dd = appData[d] || {
            dailyLog: [],
            metrics: {
              nativeSteps: 0,
              manualSteps: 0,
              nativeSleep: 0,
              manualSleep: 0,
              water: 0,
            },
          };
          const totalSleep =
            (dd.metrics.nativeSleep || 0) + (dd.metrics.manualSleep || 0);
          return `${d}: Cals: ${dd.dailyLog.reduce(
            (s, l) => s + (Number(l.calories) || 0),
            0,
          )}, Sleep: ${totalSleep}h, Water: ${dd.metrics.water}ml`;
        })
        .join("\n");

      const prompt = `Review last 72 hours for ${profile.name}. Goal: ${profile.primaryGoal}. Data: \n${ctx}\n
      Format JSON ONLY: {"title": "3-4 words", "analysis": "1 concise punchy sentence addressing the user", "actionTip": "1 specific actionable habit change for today"}`;

      const res = await executeGeminiRequest(apiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const parsed = extractJSON(res.candidates[0].content.parts[0].text);
      setBriefing(parsed);
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
    } catch (error) {
      console.warn("Briefing generation failed:", error);
      setBriefing({
        title: "Coach Ready",
        analysis: "Your daily coaching insights are ready. Ask any nutrition or workout question.",
        actionTip: "Hit your daily water target of 3,000ml today.",
      });
    } finally {
      setLoading(false);
    }
  }, [apiKey, appData, currentDate, profile]);

  useEffect(() => {
    if (!briefing) fetchBriefing();
  }, [briefing, fetchBriefing]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userText = input;
    setInput("");
    setChat((p) => [...p, { role: "user", text: userText }]);
    setLoading(true);

    const currentDayData = appData[currentDate] || {
      dailyLog: [],
      metrics: {
        nativeSteps: 0,
        manualSteps: 0,
        nativeSleep: 0,
        manualSleep: 0,
        water: 0,
      },
    };
    const cals = currentDayData.dailyLog.reduce(
      (s, l) => s + (Number(l.calories) || 0),
      0,
    );

    const liveContext = `
    LIVE DATA (${currentDate}): Calories: ${cals}/${
      profile.goals.calories
    }, Water: ${currentDayData.metrics.water || 0}ml.
    Goal: ${profile.primaryGoal}, Diet: ${profile.dietType}. 
    `;

    try {
      const contents = chat.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      contents.push({ role: "user", parts: [{ text: userText }] });
      const res = await executeGeminiRequest(apiKey, {
        contents,
        systemInstruction: {
          parts: [
            {
              text: `You are eAZfit AI, an elite, highly professional health and nutrition coach for an Indian fitness enthusiast. Answer concisely. USE THIS LIVE DATA:\n${liveContext}`,
            },
          ],
        },
      });
      const reply = res.candidates[0].content.parts[0].text;
      setChat((p) => [...p, { role: "model", text: reply }]);
      if (ttsSupport) speak(reply);
    } catch (e) {
      setChat((p) => [
        ...p,
        { role: "model", text: `Connection Error: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!briefing && loading)
    return <AILoadingState text="Compiling insights..." />;

  return (
    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 pt-4 pb-2">
      <div className="mb-4 px-2 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black tracking-tight">AI Coach</h2>
          <p className="text-[#dc143c] text-xs font-mono font-bold tracking-widest uppercase mt-0.5">
            Intelligence Online
          </p>
        </div>
        {ttsSupport && (
          <button
            onClick={() => (isSpeaking ? stop() : null)}
            className={`p-2.5 rounded-full border ${
              isSpeaking
                ? "bg-[#dc143c]/20 text-[#dc143c] border-[#dc143c]/30 animate-pulse"
                : "bg-[#121214] text-zinc-500 border-white/5"
            }`}
            title={isSpeaking ? "Mute Speech" : "Speech Ready"}
          >
            {isSpeaking ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-4 pb-4">
        {briefing && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-[#1a1a1d] to-[#121214] border border-white/10 rounded-[28px] p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#dc143c]/10 rounded-full blur-[40px] pointer-events-none" />
              <h3 className="text-lg font-black text-white tracking-tight mb-1.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#dc143c]" />
                {briefing.title}
              </h3>
              <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                {briefing.analysis}
              </p>
            </div>
            <div className="bg-[#dc143c] text-white rounded-[22px] p-4 shadow-lg shadow-[0_0_15px_rgba(220,20,60,0.2)]">
              <p className="text-[10px] font-black font-mono text-white/80 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <ActivitySquare className="w-3.5 h-3.5" /> Daily Action Step
              </p>
              <p className="text-xs font-bold leading-snug">
                {briefing.actionTip || briefing.tip || "Stay consistent with your daily targets."}
              </p>
            </div>
          </div>
        )}

        {chat.length > 0 && (
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />
        )}

        <div className="space-y-3">
          {chat.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-[22px] px-4 py-3 text-xs font-medium leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-zinc-100 text-black rounded-br-sm"
                    : "bg-[#121214] border border-white/10 text-zinc-200 rounded-bl-sm relative"
                }`}
              >
                {msg.role === "model" && ttsSupport && (
                  <button
                    onClick={() => speak(msg.text)}
                    className="absolute -right-7 top-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {msg.text}
              </div>
            </div>
          ))}
          {loading && chat.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-[#121214] border border-white/10 rounded-[20px] rounded-bl-sm p-3.5 flex gap-1.5 items-center">
                <div
                  className="w-1.5 h-1.5 bg-[#dc143c] rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-1.5 h-1.5 bg-[#dc143c] rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-1.5 h-1.5 bg-[#dc143c] rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
          <div ref={endRef} className="h-2" />
        </div>
      </div>

      <div className="shrink-0 pt-2 px-2">
        <form onSubmit={sendMsg} className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask your eAZfit coach..."
            className="w-full bg-[#121214] border border-white/10 rounded-full py-3.5 pl-5 pr-12 text-white text-xs font-medium tracking-wide focus:outline-none focus:border-[#dc143c]/50 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-[#dc143c] text-white rounded-full disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95 transition-all shadow-md"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>
      </div>
    </div>
  );
}

function StatsView({ appData }) {
  const days = getPastDays(6).reverse();
  const data = days.map((d) => {
    const log = appData[d]?.dailyLog || [];
    return {
      day: new Date(d).toLocaleDateString("en-US", { weekday: "short" }),
      cal: log.reduce((s, l) => s + (Number(l.calories) || 0), 0),
      pro: log.reduce((s, l) => s + (Number(l.protein) || 0), 0),
      carb: log.reduce((s, l) => s + (Number(l.carbs) || 0), 0),
      fat: log.reduce((s, l) => s + (Number(l.fats) || 0), 0),
    };
  });

  return (
    <div className="animate-in fade-in space-y-5 pt-4 pb-10 flex-1 flex flex-col">
      <div className="px-2">
        <h2 className="text-2xl font-black tracking-tight">Analytics</h2>
        <p className="text-[#dc143c] text-xs font-mono font-bold tracking-widest uppercase mt-0.5">
          7-Day Intake Trends
        </p>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-[32px] p-5 shadow-xl h-60 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#dc143c]/5 rounded-full blur-[50px] pointer-events-none" />
        <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 shrink-0 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-[#dc143c]" /> Caloric History (kcal)
        </h3>
        <div className="flex-1 min-h-0 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey="day"
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={6}
              />
              <Tooltip
                cursor={{ fill: "#1a1a1d" }}
                contentStyle={{
                  backgroundColor: "#09090b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "14px",
                  fontWeight: "bold",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                }}
                itemStyle={{ color: "#dc143c" }}
              />
              <Bar
                dataKey="cal"
                fill="#dc143c"
                radius={[6, 6, 6, 6]}
                barSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-[32px] p-5 shadow-xl h-64 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[50px] pointer-events-none" />
        <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 shrink-0 flex items-center gap-1.5">
          <ActivitySquare className="w-3.5 h-3.5 text-blue-400" /> Macronutrient Split (g)
        </h3>
        <div className="flex-1 min-h-0 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <XAxis
                dataKey="day"
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={6}
              />
              <YAxis
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{
                  stroke: "#27272a",
                  strokeWidth: 2,
                  strokeDasharray: "4 4",
                }}
                contentStyle={{
                  backgroundColor: "#09090b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "14px",
                  fontWeight: "bold",
                  fontSize: "11px",
                }}
              />
              <Line
                type="monotone"
                name="Protein"
                dataKey="pro"
                stroke="#dc143c"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                name="Carbs"
                dataKey="carb"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                name="Fats"
                dataKey="fat"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ProfileView({
  profile,
  setProfile,
  geminiApiKey,
  onSaveApiKey,
  onSave,
}) {
  const [localGemini, setLocalGemini] = useState(geminiApiKey);

  const handleUpdate = (field, val, nestedField = null) => {
    if (nestedField) {
      setProfile({
        ...profile,
        [field]: { ...profile[field], [nestedField]: val },
      });
    } else {
      setProfile({ ...profile, [field]: val });
    }
  };

  const saveAll = () => {
    if (localGemini !== geminiApiKey) {
      onSaveApiKey(localGemini);
    }
    onSave();
  };

  const resetData = () => {
    if (
      confirm(
        "Are you sure? This will wipe all logged data and profile settings.",
      )
    ) {
      localStorage.removeItem("eazfit_data");
      localStorage.removeItem("eazfit_profile");
      window.location.reload();
    }
  };

  return (
    <div className="animate-in fade-in space-y-5 pt-4 pb-10 px-1">
      <div className="mb-2 px-1">
        <h2 className="text-2xl font-black tracking-tight">Profile</h2>
        <p className="text-[#dc143c] text-xs font-mono font-bold tracking-widest uppercase mt-0.5">
          Settings & Goals
        </p>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-[28px] p-5 space-y-4 shadow-lg">
        <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#dc143c]" /> Base Metrics
        </h3>
        <InputGroup
          label="Preferred Name"
          type="text"
          val={profile.name || ""}
          onChange={(v) => handleUpdate("name", v)}
        />
        <div className="grid grid-cols-2 gap-3">
          <InputGroup
            label="Weight (kg)"
            type="number"
            val={profile.weight}
            onChange={(v) => handleUpdate("weight", v)}
          />
          <InputGroup
            label="Height (cm)"
            type="number"
            val={profile.height}
            onChange={(v) => handleUpdate("height", v)}
          />
          <InputGroup
            label="Age"
            type="number"
            val={profile.age}
            onChange={(v) => handleUpdate("age", v)}
          />
          <InputGroup
            label="Allergies"
            type="text"
            val={profile.allergies || ""}
            onChange={(v) => handleUpdate("allergies", v)}
          />
        </div>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-[28px] p-5 space-y-4 shadow-lg">
        <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Goal className="w-3.5 h-3.5 text-[#dc143c]" /> Daily Targets
        </h3>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
            Dietary Preferences
          </label>
          <textarea
            value={profile.customDietRules || ""}
            onChange={(e) => handleUpdate("customDietRules", e.target.value)}
            placeholder="e.g. Vegetarian, intermittent fasting until 12 PM"
            className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-3.5 text-xs font-medium text-white focus:outline-none focus:border-white/20 h-20 resize-none custom-scrollbar"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
          <InputGroup
            label="Calories (kcal)"
            type="number"
            val={profile.goals.calories}
            onChange={(v) => handleUpdate("goals", v, "calories")}
          />
          <InputGroup
            label="Protein (g)"
            type="number"
            val={profile.goals.protein}
            onChange={(v) => handleUpdate("goals", v, "protein")}
          />
          <InputGroup
            label="Carbs (g)"
            type="number"
            val={profile.goals.carbs}
            onChange={(v) => handleUpdate("goals", v, "carbs")}
          />
          <InputGroup
            label="Fats (g)"
            type="number"
            val={profile.goals.fats}
            onChange={(v) => handleUpdate("goals", v, "fats")}
          />
        </div>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-[28px] p-5 space-y-4 shadow-lg">
        <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Settings className="w-3.5 h-3.5 text-[#dc143c]" /> System Settings
        </h3>
        <InputGroup
          label="Gemini API Key (Analysis & Coaching)"
          type="password"
          val={localGemini}
          onChange={(v) => setLocalGemini(v)}
        />
        <button
          onClick={resetData}
          className="w-full mt-2 py-3 border border-red-500/20 text-red-400 font-bold rounded-2xl text-[11px] uppercase tracking-widest hover:bg-red-500/10 active:scale-98 transition-all"
        >
          Wipe All Local Data
        </button>
      </div>

      <button
        onClick={saveAll}
        className="w-full bg-[#dc143c] text-white font-black py-4 rounded-2xl active:scale-95 transition-transform tracking-wide flex justify-center items-center gap-2 shadow-xl shadow-[0_0_20px_rgba(220,20,60,0.3)] text-sm"
      >
        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> Save Configuration
      </button>

      <div className="pt-6 pb-2 flex flex-col items-center justify-center text-center">
        <BrandLogo size="sm" />
        <p className="text-[10px] font-mono text-zinc-600 mt-1.5">
          Built for Android
        </p>
      </div>
    </div>
  );
}

function SetupView({ onSave }) {
  const [geminiKey, setGeminiKey] = useState("");

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-zinc-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,20,60,0.18),transparent_60%)] pointer-events-none" />
      <div className="w-full max-w-sm space-y-7 animate-in zoom-in-95 duration-700 text-center relative z-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-1.5 font-sans">
            <span className="text-white">e</span><span className="text-[#dc143c]">AZ</span><span className="text-white">fit</span>
          </h1>
          <p className="text-[11px] font-mono font-bold text-[#dc143c] uppercase tracking-widest mb-3">
            Intelligent Fitness & Nutrition
          </p>
          <p className="text-xs text-zinc-400 font-medium leading-relaxed max-w-xs mx-auto">
            Enter your Gemini API key to activate AI coaching and native voice nutrition tracking.
          </p>
        </div>
        <div className="space-y-4">
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Gemini API Key..."
            className="w-full bg-[#121214] border border-white/10 rounded-2xl p-4 text-white text-center font-mono focus:outline-none focus:border-[#dc143c]/60 focus:ring-1 focus:ring-[#dc143c]/30 transition-colors shadow-inner text-xs"
          />
        </div>
        <button
          onClick={() => onSave(geminiKey)}
          disabled={!geminiKey.trim()}
          className="w-full bg-[#dc143c] text-white font-black py-4 rounded-2xl disabled:opacity-40 disabled:scale-100 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[0_0_20px_rgba(220,20,60,0.3)] text-xs uppercase tracking-widest flex items-center justify-center"
        >
          Get Started
        </button>
        <p className="text-[10px] text-zinc-600 font-mono">
          Key is stored locally on this Android device.
        </p>
      </div>
    </div>
  );
}

function OnboardingView({ onComplete }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: "",
    weight: 70,
    height: 175,
    age: 26,
    gender: "male",
    dietType: "Standard",
    allergies: "",
    primaryGoal: "maintain",
    activityLevel: "1.55",
  });

  const calculateMacros = () => {
    let bmr = 10 * data.weight + 6.25 * data.height - 5 * data.age;
    bmr += data.gender === "male" ? 5 : -161;

    let tdee = Math.round(bmr * Number(data.activityLevel));

    if (data.primaryGoal === "cut") tdee -= 500;
    if (data.primaryGoal === "bulk") tdee += 500;

    const protein = Math.round(data.weight * 2.0);
    const proteinCals = protein * 4;
    const fat = Math.round((tdee * 0.25) / 9);
    const fatCals = fat * 9;
    const carbs = Math.round(Math.max(0, tdee - proteinCals - fatCals) / 4);

    onComplete({
      ...data,
      goals: {
        calories: tdee,
        protein,
        carbs,
        fats: fat,
        steps: 10000,
        water: 3000,
        sleep: 8,
      },
    });
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-6 custom-scrollbar overflow-y-auto relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#dc143c]/10 rounded-full blur-[80px]" />

      <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-right duration-500 my-auto py-8 relative z-10">
        <div className="flex justify-between items-center mb-2">
          <BrandLogo size="sm" />
          <span className="text-[10px] font-mono font-bold text-[#dc143c] bg-[#dc143c]/10 border border-[#dc143c]/20 px-2.5 py-1 rounded-full">
            Step {step} of 3
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-black tracking-tight mb-1">
                Your Baseline
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Let's establish your physical stats.
              </p>
            </div>
            <div className="space-y-3.5">
              <InputGroup
                label="Preferred Name"
                type="text"
                val={data.name}
                onChange={(v) => setData({ ...data, name: v })}
              />
              <div className="grid grid-cols-2 gap-3">
                <InputGroup
                  label="Weight (kg)"
                  type="number"
                  val={data.weight}
                  onChange={(v) => setData({ ...data, weight: Number(v) })}
                />
                <InputGroup
                  label="Height (cm)"
                  type="number"
                  val={data.height}
                  onChange={(v) => setData({ ...data, height: Number(v) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputGroup
                  label="Age"
                  type="number"
                  val={data.age}
                  onChange={(v) => setData({ ...data, age: Number(v) })}
                />
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                    Gender
                  </label>
                  <select
                    value={data.gender}
                    onChange={(e) =>
                      setData({ ...data, gender: e.target.value })
                    }
                    className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!data.name}
              className="w-full bg-white text-black font-black py-4 rounded-2xl disabled:opacity-40 active:scale-95 transition-all text-xs uppercase tracking-widest shadow-lg mt-2"
            >
              Next: Diet & Goals
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-black tracking-tight mb-1">
                Diet & Goals
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Tailor macro distribution to your lifestyle.
              </p>
            </div>
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                  Diet Type
                </label>
                <select
                  value={data.dietType}
                  onChange={(e) =>
                    setData({ ...data, dietType: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none"
                >
                  <option value="Standard">Standard / Omnivore</option>
                  <option value="Vegetarian">Vegetarian (Indian)</option>
                  <option value="Eggetarian">Eggetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Keto">Keto</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                  Primary Objective
                </label>
                <select
                  value={data.primaryGoal}
                  onChange={(e) =>
                    setData({ ...data, primaryGoal: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none"
                >
                  <option value="cut">Fat Loss (Cut -500 kcal)</option>
                  <option value="maintain">Maintenance (Lean Recomp)</option>
                  <option value="bulk">Muscle Gain (Bulk +500 kcal)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                  Activity Level
                </label>
                <select
                  value={data.activityLevel}
                  onChange={(e) =>
                    setData({ ...data, activityLevel: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none"
                >
                  <option value="1.2">Sedentary (Desk Job)</option>
                  <option value="1.375">Lightly Active (1-3 days/wk)</option>
                  <option value="1.55">Moderately Active (3-5 days/wk)</option>
                  <option value="1.725">Very Active (6-7 days/wk)</option>
                </select>
              </div>

              <InputGroup
                label="Allergies / Dislikes"
                type="text"
                val={data.allergies}
                onChange={(v) => setData({ ...data, allergies: v })}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-4 rounded-2xl bg-white/5 text-zinc-400 font-bold text-xs uppercase"
              >
                Back
              </button>
              <button
                onClick={calculateMacros}
                className="flex-1 bg-[#dc143c] text-white font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[0_0_20px_rgba(220,20,60,0.3)]"
              >
                Start Tracking
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AILoadingState({ text }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 h-full">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-2 border-[#dc143c]/20 border-t-[#dc143c] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <ActivitySquare className="w-6 h-6 text-[#dc143c] animate-pulse" />
        </div>
      </div>
      <h3 className="text-xl font-black mb-1 tracking-tight text-white">
        Processing Data
      </h3>
      <p className="text-xs text-zinc-400 font-mono tracking-wide">{text}</p>
    </div>
  );
}

function InputGroup({ label, type, val, onChange }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
        {label}
      </label>
      <input
        type={type}
        value={val}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none focus:border-white/20 transition-colors shadow-inner"
      />
    </div>
  );
}

function TabButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center flex-1 py-1 gap-1 transition-all duration-200 ${
        active
          ? "text-[#dc143c] font-bold"
          : "text-zinc-500 hover:text-zinc-300 font-medium"
      }`}
    >
      {React.cloneElement(icon, {
        className: `w-5 h-5 transition-transform duration-200 ${
          active ? "scale-110 drop-shadow-[0_0_8px_rgba(220,20,60,0.5)]" : ""
        }`,
      })}
      <span className="text-[10px] tracking-tight leading-none">
        {label}
      </span>
      {active && (
        <span className="w-1 h-1 rounded-full bg-[#dc143c] mt-0.5" />
      )}
    </button>
  );
}

function MacroCard({ title, current, max, color }) {
  const p = Math.min(100, (current / max) * 100) || 0;
  return (
    <div className="bg-[#121214] border border-white/5 rounded-[24px] p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group">
      <div
        className={`absolute inset-0 ${color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
      />
      <div className="flex justify-between items-center mb-3">
        <span className="text-zinc-500 text-[10px] font-mono font-bold uppercase tracking-widest">
          {title}
        </span>
        <span className="text-[10px] font-mono text-zinc-500 font-bold">
          {Math.round(p)}%
        </span>
      </div>
      <div>
        <div className="flex items-baseline gap-0.5 mb-2.5">
          <span className="text-xl font-black tracking-tight text-white font-mono">
            {current}
            <span className="text-xs font-sans text-zinc-400 font-bold ml-0.5">g</span>
          </span>
          <span className="text-[11px] text-zinc-600 font-mono font-bold">/{max}g</span>
        </div>
        <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/5">
          <div
            className={`h-full ${color} rounded-full transition-all duration-1000 relative`}
            style={{ width: `${p}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({
  icon,
  label,
  value,
  goal,
  unit,
  onAction,
  onQuickAction,
  bg = "bg-white/5",
}) {
  const formatVal = (v) => typeof v === "number" ? v.toLocaleString() : v;
  return (
    <div className="bg-[#121214] border border-white/5 rounded-[24px] p-4 flex items-center justify-between shadow-lg hover:border-white/10 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-2xl ${bg}`}>{icon}</div>
        <div>
          <p className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-widest">
            {label}
          </p>
          <p className="font-black tracking-tight text-base text-white font-mono">
            {formatVal(value)}
            <span className="text-[11px] text-zinc-500 font-sans font-semibold ml-1">
              / {formatVal(goal)}{unit}
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {onQuickAction && (
          <button
            onClick={onQuickAction}
            className="p-1.5 rounded-full bg-white/5 hover:bg-[#dc143c]/20 hover:text-[#dc143c] active:scale-90 transition-all text-zinc-400"
            title="Quick Add 250ml"
          >
            <PlusCircle className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onAction}
          className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-all text-zinc-400"
          title="Manual Update"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ManualEntryModal({ type, onClose, onSave }) {
  const [val, setVal] = useState("");

  const modalConfig = {
    water: {
      title: "Log Water Intake",
      icon: <Droplets className="text-cyan-400 w-5 h-5" />,
      unit: "ml",
      presets: [250, 500, 750, 1000],
    },
    steps: {
      title: "Log Manual Steps",
      icon: <Activity className="text-rose-400 w-5 h-5" />,
      unit: "steps",
      presets: [1000, 2500, 5000, 10000],
    },
    sleep: {
      title: "Log Manual Sleep",
      icon: <Moon className="text-indigo-400 w-5 h-5" />,
      unit: "hours",
      presets: [0.5, 1, 2, 8],
    },
  };

  const config = modalConfig[type] || modalConfig.water;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="bg-[#121214] border border-white/10 rounded-[32px] w-full max-w-sm relative z-10 p-6 shadow-2xl zoom-in-95 animate-in">
        <h3 className="text-lg font-black tracking-tight text-white mb-4 flex items-center gap-2">
          {config.icon}
          {config.title}
        </h3>

        <div className="flex gap-2 mb-4 overflow-x-auto custom-scrollbar">
          {config.presets.map((preset) => (
            <button
              key={preset}
              onClick={() => setVal(String(preset))}
              className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold font-mono text-zinc-300 border border-white/5 transition-colors"
            >
              +{preset}{config.unit === "hours" ? "h" : ""}
            </button>
          ))}
        </div>

        <div className="relative mb-6">
          <input
            type="number"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="0"
            className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-4 text-white text-3xl font-black font-mono text-center focus:outline-none focus:border-[#dc143c]/50 shadow-inner"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-zinc-500">
            {config.unit}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 font-bold rounded-2xl bg-white/5 text-zinc-300 text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (val) {
                onSave(Number(val));
                onClose();
              }
            }}
            disabled={!val}
            className="flex-1 py-3.5 font-black rounded-2xl bg-[#dc143c] text-white text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[0_0_20px_rgba(220,20,60,0.3)] disabled:opacity-40"
          >
            Add to Day
          </button>
        </div>
      </div>
    </div>
  );
}

function LogDetailModal({ log, onClose, onUpdate, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [data, setData] = useState(log);
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end animate-in fade-in duration-300">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="bg-[#121214] border-t border-white/10 rounded-t-[40px] w-full max-w-md mx-auto relative z-10 p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] slide-in-from-bottom-full animate-in duration-300">
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />

        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-white capitalize">
              {data.foodName}
            </h3>
            <p className="text-zinc-500 text-xs font-mono font-bold uppercase tracking-widest mt-1">
              {data.mealType || "Snack"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEdit(!edit)}
              className={`p-2.5 rounded-full transition-colors ${
                edit
                  ? "bg-white text-black"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
              title="Edit Entry"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(log.id)}
              className="p-2.5 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20 transition-colors"
              title="Delete Entry"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {edit ? (
          <div className="space-y-4 mb-2 animate-in fade-in">
            <div className="grid grid-cols-2 gap-3">
              <InputGroup
                label="Calories (kcal)"
                type="number"
                val={data.calories}
                onChange={(v) => setData({ ...data, calories: Number(v) })}
              />
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                  Meal Slot
                </label>
                <select
                  value={data.mealType}
                  onChange={(e) =>
                    setData({ ...data, mealType: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none appearance-none"
                >
                  {["breakfast", "lunch", "snack", "dinner"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <InputGroup
                label="Protein (g)"
                type="number"
                val={data.protein}
                onChange={(v) => setData({ ...data, protein: Number(v) })}
              />
              <InputGroup
                label="Carbs (g)"
                type="number"
                val={data.carbs}
                onChange={(v) => setData({ ...data, carbs: Number(v) })}
              />
              <InputGroup
                label="Fats (g)"
                type="number"
                val={data.fats}
                onChange={(v) => setData({ ...data, fats: Number(v) })}
              />
            </div>
            <button
              onClick={() => onUpdate(data)}
              className="w-full bg-[#dc143c] text-white font-black py-4 rounded-2xl mt-4 shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest"
            >
              Save Adjustments
            </button>
          </div>
        ) : (
          <div className="mb-2 space-y-6 animate-in fade-in">
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black tracking-tight text-white font-mono">
                {data.calories}
              </span>
              <span className="text-xs text-zinc-500 font-mono font-bold uppercase tracking-widest">
                kcal
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#dc143c]/10 border border-[#dc143c]/20 rounded-2xl p-4 flex flex-col justify-center shadow-inner">
                <p className="text-[10px] text-[#dc143c] uppercase tracking-widest font-mono font-bold mb-1">
                  Protein
                </p>
                <p className="text-2xl font-black text-white font-mono">
                  {data.protein}g
                </p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col justify-center shadow-inner">
                <p className="text-[10px] text-blue-400 uppercase tracking-widest font-mono font-bold mb-1">
                  Carbs
                </p>
                <p className="text-2xl font-black text-white font-mono">{data.carbs}g</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col justify-center shadow-inner">
                <p className="text-[10px] text-amber-400 uppercase tracking-widest font-mono font-bold mb-1">
                  Fats
                </p>
                <p className="text-2xl font-black text-white font-mono">{data.fats}g</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
