import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";

type SessionHistoryItem = {
  id: string;
  completedAtIso: string;
  durationSeconds: number;
  purpose: string;
};

type AlertSoundOption = "Chime" | "Bell" | "Beep";

const DEFAULT_PRESET_MINUTES = [1, 3, 5] as const;
const SAVED_PRESETS_KEY = "kicktalk.presetMinutes.v3";
const HISTORY_KEY = "kicktalk.sessionHistory.v2";

const formatSeconds = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const formatDurationForSpeech = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const parts: string[] = [];

  if (mins > 0) {
    parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);
  }
  if (secs > 0) {
    parts.push(`${secs} ${secs === 1 ? "second" : "seconds"}`);
  }
  return parts.length > 0 ? parts.join(" ") : "0 seconds";
};

const parseInputNumber = (input: string) => {
  const parsed = Number.parseInt(input.trim(), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

const formatHistoryDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function App() {
  const [totalSeconds, setTotalSeconds] = useState(60);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStartedTicking, setHasStartedTicking] = useState(false);

  const [minutesInput, setMinutesInput] = useState("1");
  const [secondsInput, setSecondsInput] = useState("00");
  const [purposeInput, setPurposeInput] = useState("");
  const [activePurpose, setActivePurpose] = useState("");

  const [presetMinutes, setPresetMinutes] = useState<number[]>([...DEFAULT_PRESET_MINUTES]);
  const [presetEditInputs, setPresetEditInputs] = useState<string[]>(["1", "3", "5"]);
  const [isEditingPresetTimers, setIsEditingPresetTimers] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [selectedPresetMinute, setSelectedPresetMinute] = useState<number>(1);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>("");
  const [historyDisplayCountInput, setHistoryDisplayCountInput] = useState("3");

  const [showIntroGuide, setShowIntroGuide] = useState(false);
  const [showQaPanel, setShowQaPanel] = useState(false);
  const [qaMessage, setQaMessage] = useState("");

  const [alertSound, setAlertSound] = useState<AlertSoundOption>("Chime");
  const [showAlertSoundDropdown, setShowAlertSoundDropdown] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const parsedHistoryCount = parseInputNumber(historyDisplayCountInput);
  const historyDisplayCount = parsedHistoryCount > 0 ? Math.min(parsedHistoryCount, 15) : 3;
  const visibleHistory = sessionHistory.slice(0, historyDisplayCount);
  const typedPurpose = purposeInput.trim();
  const effectivePurpose = typedPurpose || activePurpose.trim();
  const displayedSeconds = hasStartedTicking ? remainingSeconds : totalSeconds;

  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const [storedPresets, storedHistory] = await Promise.all([
          AsyncStorage.getItem(SAVED_PRESETS_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
        ]);

        if (storedPresets) {
          const parsed = JSON.parse(storedPresets) as number[];
          if (Array.isArray(parsed) && parsed.length === 3) {
            setPresetMinutes(parsed);
            setPresetEditInputs(parsed.map((item) => String(item)));
            setSelectedPresetMinute(parsed[0]);
          }
        }
        if (storedHistory) {
          const parsed = JSON.parse(storedHistory) as SessionHistoryItem[];
          setSessionHistory(parsed);
        }
      } catch {
        Alert.alert("Storage warning", "Could not load saved presets/history.");
      }
    };

    loadPersistedData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(SAVED_PRESETS_KEY, JSON.stringify(presetMinutes)).catch(() => {
      Alert.alert("Storage warning", "Could not save presets.");
    });
  }, [presetMinutes]);

  useEffect(() => {
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessionHistory)).catch(() => {
      Alert.alert("Storage warning", "Could not save history.");
    });
  }, [sessionHistory]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          void onTimerComplete();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isRunning, totalSeconds, activePurpose, alertSound, vibrationEnabled, voiceEnabled]);

  const progressRatio = useMemo(() => {
    if (totalSeconds <= 0) {
      return 0;
    }
    return remainingSeconds / totalSeconds;
  }, [remainingSeconds, totalSeconds]);

  const onTimerComplete = async () => {
    const alertPrefixBySound: Record<AlertSoundOption, string> = {
      Chime: "Chime alert.",
      Bell: "Bell alert.",
      Beep: "Beep alert.",
    };
    const vibrationPatternBySound: Record<AlertSoundOption, number[]> = {
      Chime: [0, 140, 60, 140],
      Bell: [0, 250, 120, 250],
      Beep: [0, 80, 60, 80, 60, 80],
    };

    setIsRunning(false);
    setHasStartedTicking(false);
    if (voiceEnabled) {
      const purposeLine = effectivePurpose ? `. Purpose was ${effectivePurpose}.` : "";
      Speech.stop();
      Speech.speak(`${alertPrefixBySound[alertSound]} Time is up${purposeLine}`);
    }
    if (vibrationEnabled) {
      Vibration.vibrate(vibrationPatternBySound[alertSound]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    setSessionHistory((current) =>
      [
        {
          id: `${Date.now()}`,
          completedAtIso: new Date().toISOString(),
          durationSeconds: totalSeconds,
          purpose: effectivePurpose || "none",
        },
        ...current,
      ].slice(0, 15)
    );

    Alert.alert("Timer complete", "Great work. Session saved to history.");
  };

  const applyCustomTimerAndPurpose = () => {
    const minutes = parseInputNumber(minutesInput);
    const seconds = Math.min(parseInputNumber(secondsInput), 59);
    const nextDuration = minutes * 60 + seconds;
    if (nextDuration <= 0) {
      Alert.alert("Invalid duration", "Please enter at least 1 second.");
      return;
    }

    const trimmedPurpose = purposeInput.trim();
    setIsRunning(false);
    setHasStartedTicking(false);
    setTotalSeconds(nextDuration);
    setRemainingSeconds(nextDuration);
    setActivePurpose(trimmedPurpose);
  };

  const applyQuickPreset = (minutes: number) => {
    const nextDuration = minutes * 60;
    setMinutesInput(String(minutes));
    setSecondsInput("00");
    setIsRunning(false);
    setHasStartedTicking(false);
    setTotalSeconds(nextDuration);
    setRemainingSeconds(nextDuration);
    setActivePurpose(purposeInput.trim());
  };

  const handlePresetSelect = (minutes: number) => {
    setSelectedPresetMinute(minutes);
    applyQuickPreset(minutes);
    setShowPresetDropdown(false);
  };

  const onPresetEditInputChange = (index: number, value: string) => {
    setPresetEditInputs((current) => current.map((item, idx) => (idx === index ? value : item)));
  };

  const toggleModifyPresetTimers = () => {
    if (!isEditingPresetTimers) {
      setPresetEditInputs(presetMinutes.map((item) => String(item)));
      setIsEditingPresetTimers(true);
      return;
    }

    const parsed = presetEditInputs.map((item) => parseInputNumber(item));
    if (parsed.some((item) => item <= 0)) {
      Alert.alert("Invalid preset value", "Preset minutes must be positive integers.");
      return;
    }

    const nextPresetMinutes = parsed.slice(0, 3);
    setPresetMinutes(nextPresetMinutes);
    setSelectedPresetMinute(nextPresetMinutes[0]);
    setIsEditingPresetTimers(false);
    setShowPresetDropdown(false);
  };

  const toggleTimer = () => {
    if (remainingSeconds === 0) {
      setRemainingSeconds(totalSeconds);
    }
    if (!isRunning && voiceEnabled) {
      const durationLabel = formatDurationForSpeech(totalSeconds);
      const purposeLine = effectivePurpose
        ? `Purpose: ${effectivePurpose}.`
        : "No purpose set.";
      Speech.stop();
      Speech.speak(`Timer for ${durationLabel}. ${purposeLine}`);
    }
    if (!isRunning) {
      setHasStartedTicking(true);
    }
    setIsRunning((current) => !current);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
    setHasStartedTicking(false);
  };

  const applyHistoryAsNewTimer = (session: SessionHistoryItem) => {
    const mins = Math.floor(session.durationSeconds / 60);
    const secs = session.durationSeconds % 60;
    setIsRunning(false);
    setHasStartedTicking(false);
    setTotalSeconds(session.durationSeconds);
    setRemainingSeconds(session.durationSeconds);
    setMinutesInput(String(mins));
    setSecondsInput(String(secs).padStart(2, "0"));
    setPurposeInput(session.purpose === "none" ? "" : session.purpose);
    setActivePurpose(session.purpose === "none" ? "" : session.purpose);
    Alert.alert("Timer updated", "History record applied as new timer.");
  };

  const submitQa = () => {
    const finalMessage =
      "Thank you for your time! Message well received. We will get back to you within 24 hours.";
    Alert.alert("Q&A submitted", finalMessage);
    Speech.stop();
    Speech.speak(finalMessage);
    setQaMessage("");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>KickTalk timer</Text>

        <View style={styles.topButtonsRow}>
          <Pressable
            style={[styles.roundTab, showIntroGuide ? styles.roundTabActive : null]}
            onPress={() => setShowIntroGuide((current) => !current)}
          >
            <Text style={[styles.roundTabText, showIntroGuide ? styles.roundTabTextActive : null]}>
              Introduction
            </Text>
          </Pressable>
        </View>

        {showIntroGuide ? (
          <View style={styles.introGuideCard}>
            <Text style={styles.sectionTitle}>Introduction</Text>
            <Text style={styles.helperText}>Simple pic: [ Start ] then [ Speak ] then [ End ]</Text>
            <Text style={styles.helperText}>
              How to use: define timer and purpose, apply, then start ticking.
            </Text>
            <Text style={styles.helperText}>Click Intro again to close this section anytime.</Text>
          </View>
        ) : null}

        <View style={styles.controlsRow}>
          <Pressable style={styles.primaryButton} onPress={toggleTimer}>
            <Text style={styles.primaryButtonText}>{isRunning ? "Pause" : "Start"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={resetTimer}>
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
        </View>

        <View style={styles.timerCard}>
          <Text style={styles.roundName}>Timer</Text>
          <Text style={styles.timerText}>{formatSeconds(displayedSeconds)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(0, progressRatio * 100)}%` }]} />
          </View>
          <Text style={styles.purposePreview}>
            Purpose: {effectivePurpose || "none"}
          </Text>

          <View style={styles.timeInputRow}>
            <TextInput
              value={minutesInput}
              onChangeText={setMinutesInput}
              keyboardType="number-pad"
              style={styles.timeInput}
              placeholder="Min"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.timeColon}>:</Text>
            <TextInput
              value={secondsInput}
              onChangeText={setSecondsInput}
              keyboardType="number-pad"
              style={styles.timeInput}
              placeholder="Sec"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <TextInput
            value={purposeInput}
            onChangeText={setPurposeInput}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={styles.purposeInput}
            placeholder="Purpose for this timer (optional). Default is none. 30+ chars if used (max 100)."
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />

          <Pressable style={styles.applyButton} onPress={applyCustomTimerAndPurpose}>
            <Text style={styles.applyButtonText}>Apply To Timer</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Saved Presets</Text>
          <Text style={styles.helperText}>Default preset timers: 1m, 3m, 5m.</Text>
          <View style={styles.listBlock}>
            <Pressable
              style={styles.dropdownHeader}
              onPress={() => setShowPresetDropdown((current) => !current)}
            >
              <Text style={styles.listApplyText}>Selected: {selectedPresetMinute}m</Text>
              <Text style={styles.deleteButtonText}>{showPresetDropdown ? "Hide" : "Show"}</Text>
            </Pressable>
            {showPresetDropdown
              ? presetMinutes.map((minutes) => (
                  <Pressable
                    key={minutes}
                    style={[
                      styles.dropdownItem,
                      selectedPresetMinute === minutes ? styles.roundTabActive : null,
                    ]}
                    onPress={() => handlePresetSelect(minutes)}
                  >
                    <Text
                      style={[
                        styles.listApplyText,
                        selectedPresetMinute === minutes ? styles.roundTabTextActive : null,
                      ]}
                    >
                      {minutes}m
                    </Text>
                  </Pressable>
                ))
              : null}

            {isEditingPresetTimers ? (
              <View style={styles.presetRow}>
                {presetEditInputs.map((value, index) => (
                  <TextInput
                    key={`preset-input-${index}`}
                    value={value}
                    onChangeText={(text) => onPresetEditInputChange(index, text)}
                    keyboardType="number-pad"
                    style={styles.historyCountInput}
                    placeholder="min"
                    placeholderTextColor="#9ca3af"
                  />
                ))}
              </View>
            ) : null}

            <Pressable style={styles.applyButton} onPress={toggleModifyPresetTimers}>
              <Text style={styles.applyButtonText}>
                {isEditingPresetTimers ? "Save Preset timers" : "Modify Preset timers"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          <Text style={styles.helperText}>
            Select alert sound style and enable voice/vibration as needed.
          </Text>
          <Pressable
            style={styles.dropdownHeader}
            onPress={() => setShowAlertSoundDropdown((current) => !current)}
          >
            <Text style={styles.listApplyText}>Alert sound: {alertSound}</Text>
            <Text style={styles.deleteButtonText}>{showAlertSoundDropdown ? "Hide" : "Show"}</Text>
          </Pressable>
          {showAlertSoundDropdown
            ? (["Chime", "Bell", "Beep"] as AlertSoundOption[]).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.dropdownItem, alertSound === option ? styles.roundTabActive : null]}
                  onPress={() => {
                    setAlertSound(option);
                    setShowAlertSoundDropdown(false);
                  }}
                >
                  <Text
                    style={[styles.listApplyText, alertSound === option ? styles.roundTabTextActive : null]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))
            : null}
          <View style={styles.presetRow}>
            <Pressable
              style={[styles.quickPresetButton, voiceEnabled ? styles.roundTabActive : null]}
              onPress={() => setVoiceEnabled((current) => !current)}
            >
              <Text style={[styles.quickPresetText, voiceEnabled ? styles.roundTabTextActive : null]}>
                Voice: {voiceEnabled ? "On" : "Off"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.quickPresetButton, vibrationEnabled ? styles.roundTabActive : null]}
              onPress={() => setVibrationEnabled((current) => !current)}
            >
              <Text
                style={[styles.quickPresetText, vibrationEnabled ? styles.roundTabTextActive : null]}
              >
                Vibration: {vibrationEnabled ? "On" : "Off"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.sectionTitle}>Session History</Text>
          <View style={styles.historyControlsRow}>
            <Text style={styles.helperText}>Show last</Text>
            <TextInput
              value={historyDisplayCountInput}
              onChangeText={setHistoryDisplayCountInput}
              keyboardType="number-pad"
              style={styles.historyCountInput}
              placeholder="3"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.helperText}>records</Text>
          </View>
          {sessionHistory.length === 0 ? (
            <Text style={styles.helperText}>No completed sessions yet.</Text>
          ) : (
            <View style={styles.listBlock}>
              <Pressable
                style={styles.dropdownHeader}
                onPress={() => setShowHistoryDropdown((current) => !current)}
              >
                <Text style={styles.listApplyText}>
                  {selectedHistoryId
                    ? `Selected: ${
                        visibleHistory.find((session) => session.id === selectedHistoryId)
                          ? formatHistoryDate(
                              visibleHistory.find((session) => session.id === selectedHistoryId)!
                                .completedAtIso
                            )
                          : "History"
                      }`
                    : "Select history session"}
                </Text>
                <Text style={styles.deleteButtonText}>{showHistoryDropdown ? "Hide" : "Show"}</Text>
              </Pressable>
              {showHistoryDropdown
                ? visibleHistory.map((session) => (
                    <Pressable
                      key={session.id}
                      style={[
                        styles.dropdownItem,
                        selectedHistoryId === session.id ? styles.roundTabActive : null,
                      ]}
                      onPress={() => setSelectedHistoryId(session.id)}
                    >
                      <Text
                        style={[
                          styles.listApplyText,
                          selectedHistoryId === session.id ? styles.roundTabTextActive : null,
                        ]}
                      >
                        {formatHistoryDate(session.completedAtIso)} | {formatSeconds(session.durationSeconds)}{" "}
                        | {session.purpose}
                      </Text>
                    </Pressable>
                  ))
                : null}
              <Pressable
                onPress={() => {
                  const found = visibleHistory.find((session) => session.id === selectedHistoryId);
                  if (found) {
                    applyHistoryAsNewTimer(found);
                  } else {
                    Alert.alert("No history selected", "Please select a history session first.");
                  }
                }}
                style={styles.useHistoryButton}
              >
                <Text style={styles.useHistoryButtonText}>Use Selected As New Timer</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.bottomQaWrap}>
          <Pressable
            style={[styles.qaButton, showQaPanel ? styles.roundTabActive : null]}
            onPress={() => setShowQaPanel((current) => !current)}
          >
            <Text style={[styles.qaButtonText, showQaPanel ? styles.roundTabTextActive : null]}>
              Q&A
            </Text>
          </Pressable>
        </View>

        {showQaPanel ? (
          <View style={styles.inputCard}>
            <Text style={styles.sectionTitle}>Q&A Session</Text>
            <Text style={styles.helperText}>Any question, suggestion is more than welcome.</Text>
            <TextInput
              value={qaMessage}
              onChangeText={setQaMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={styles.purposeInput}
              placeholder="Write your question or suggestion here."
              placeholderTextColor="#9ca3af"
            />
            <Pressable style={styles.applyButton} onPress={submitQa}>
              <Text style={styles.applyButtonText}>Submit</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f6f3",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: -6,
    color: "#4b5563",
    fontSize: 15,
  },
  topButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  roundTab: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  roundTabActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  roundTabText: {
    fontWeight: "700",
    color: "#374151",
  },
  roundTabTextActive: {
    color: "#f8fafc",
  },
  introGuideCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 12,
    gap: 8,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1.4,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "700",
  },
  timerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    elevation: 4,
    gap: 10,
  },
  roundName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },
  timerText: {
    marginTop: 6,
    fontSize: 62,
    fontWeight: "700",
    textAlign: "center",
    color: "#0f172a",
    letterSpacing: 1,
  },
  progressTrack: {
    marginTop: 12,
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563eb",
  },
  purposePreview: {
    marginTop: 10,
    textAlign: "center",
    color: "#4b5563",
    fontSize: 13,
  },
  inputCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  sectionTitle: {
    fontWeight: "800",
    color: "#1f2937",
  },
  helperText: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 18,
  },
  timeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  timeInput: {
    width: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 18,
    textAlign: "center",
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  timeColon: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  purposeInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 10,
    minHeight: 80,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  applyButton: {
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  applyButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickPresetButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f8fafc",
    paddingVertical: 9,
    alignItems: "center",
  },
  quickPresetText: {
    color: "#1f2937",
    fontWeight: "700",
  },
  savePresetButton: {
    borderRadius: 10,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  savePresetText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listBlock: {
    gap: 8,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownHeader: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f8fafc",
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f8fafc",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  listApplyButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f8fafc",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  listApplyText: {
    color: "#1f2937",
    fontSize: 13,
  },
  deleteButton: {
    borderRadius: 10,
    backgroundColor: "#fee2e2",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  deleteButtonText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
  },
  historyControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyCountInput: {
    width: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    color: "#111827",
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  historyCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    padding: 10,
    gap: 4,
  },
  historyTitle: {
    color: "#111827",
    fontWeight: "700",
  },
  historyText: {
    color: "#374151",
    fontSize: 12,
  },
  useHistoryButton: {
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#e0e7ff",
    paddingVertical: 8,
    alignItems: "center",
  },
  useHistoryButtonText: {
    color: "#3730a3",
    fontWeight: "700",
    fontSize: 12,
  },
  bottomQaWrap: {
    paddingBottom: 18,
  },
  qaButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  qaButtonText: {
    color: "#1f2937",
    fontWeight: "800",
  },
});
