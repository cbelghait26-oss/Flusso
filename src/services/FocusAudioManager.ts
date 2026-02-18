import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { AppState, AppStateStatus } from "react-native";

export type Room = "mountain" | "ocean" | "skyline" | "space" | "forest";
export type MusicStyle = "recommended" | "lofi" | "piano" | "classical";

type StyleKey = Exclude<MusicStyle, "recommended">;

type SoundRef = {
  sound: Audio.Sound;
  asset: number;
};

const MUSIC_ASSETS: Record<StyleKey, number> = {
  lofi: require("../../assets/focus/lofi.mp3"),
  piano: require("../../assets/focus/ModernPiano.mp3"),
  // TODO: add a loopable classical-inspired asset here.
  classical: require("../../assets/focus/ClassicLoop.mp3"),
};

const AMBIENT_WAVES_ASSET = require("../../assets/focus/waves_loop.mp3");

export const ROOM_BACKGROUNDS: Record<Room, number> = {
  mountain: require("../../assets/focus/mountainMOB.png"),
  ocean: require("../../assets/focus/Ocean1.png"),
  skyline: require("../../assets/focus/skylineMOB.png"),
  space: require("../../assets/focus/space.png"),
  forest: require("../../assets/focus/forest1.png"),
};

const RECOMMENDED_BY_ROOM: Record<Room, StyleKey> = {
  mountain: "piano",
  ocean: "lofi",
  skyline: "lofi",
  space: "classical",
  forest: "piano",
};

class FocusAudioManager {
  private initialized = false;
  private room: Room = "mountain";
  private style: StyleKey = RECOMMENDED_BY_ROOM.mountain;

  private musicPrimary: SoundRef | null = null;
  private musicSecondary: SoundRef | null = null;
  private ambient: SoundRef | null = null;

  private isAmbientOn = false;
  private musicVolume = 0.6;
  private ambientVolume = 0.35;

  private isSwitching = false;
  private loopInProgress = false;
  private operationId = 0;
  private lastSwitchAt = 0;

  private appState: AppStateStatus = AppState.currentState;
  private wasPlayingBeforeBackground = false;
  private appStateSub?: { remove: () => void };

  private readonly loopFadeMs = 2000;
  private readonly switchFadeMs = 1200;
  private readonly fadeStepMs = 50;
  private readonly minSwitchIntervalMs = 450;
  private readonly loopPreRollMs = 400;

  async init() {
    if (this.initialized) return;

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });

    this.appStateSub = AppState.addEventListener("change", (next) => {
      this.handleAppState(next);
    });

    this.initialized = true;
  }

  async play(room: Room, style: MusicStyle = "recommended") {
    await this.init();

    this.room = room;
    this.style = style === "recommended" ? RECOMMENDED_BY_ROOM[room] : style;

    await this.stopMusicOnly();
    await this.ensureAmbient();

    await this.startMusic(this.style);
  }

  async switchStyle(style: MusicStyle) {
    await this.init();

    const now = Date.now();
    if (now - this.lastSwitchAt < this.minSwitchIntervalMs) return;
    this.lastSwitchAt = now;

    const nextStyle = style === "recommended" ? RECOMMENDED_BY_ROOM[this.room] : style;
    if (nextStyle === this.style && this.musicPrimary) return;

    const opId = ++this.operationId;
    this.isSwitching = true;

    try {
      const nextSound = await this.createSound(MUSIC_ASSETS[nextStyle], 0);
      if (opId !== this.operationId) {
        await nextSound.sound.unloadAsync();
        return;
      }

      await nextSound.sound.playAsync();
      await this.crossfadeMusic(nextSound, this.switchFadeMs, opId);
      this.style = nextStyle;
    } finally {
      if (opId === this.operationId) this.isSwitching = false;
    }
  }

  async toggleAmbient(on: boolean) {
    await this.init();

    this.isAmbientOn = on;
    if (!on) {
      await this.fadeOutAndStopAmbient();
      return;
    }

    await this.ensureAmbient();
  }

  async setVolumes(params: { musicVolume?: number; ambientVolume?: number }) {
    if (typeof params.musicVolume === "number") {
      this.musicVolume = this.clamp01(params.musicVolume);
      if (this.musicPrimary) {
        await this.musicPrimary.sound.setVolumeAsync(this.musicVolume);
      }
      if (this.musicSecondary) {
        await this.musicSecondary.sound.setVolumeAsync(this.musicVolume);
      }
    }

    if (typeof params.ambientVolume === "number") {
      this.ambientVolume = this.clamp01(params.ambientVolume);
      if (this.ambient) {
        await this.ambient.sound.setVolumeAsync(this.ambientVolume);
      }
    }
  }

  async stop() {
    await this.stopMusicOnly();
    await this.fadeOutAndStopAmbient();
  }

  async dispose() {
    await this.stop();
    this.appStateSub?.remove();
    this.appStateSub = undefined;
    this.initialized = false;
  }

  /* ------------------ Internal helpers ------------------ */

  private async startMusic(style: StyleKey) {
    const soundRef = await this.createSound(MUSIC_ASSETS[style], this.musicVolume);
    this.musicPrimary = soundRef;
    await soundRef.sound.playAsync();
    this.attachLoopWatcher(soundRef);
  }

  private async stopMusicOnly() {
    this.loopInProgress = false;
    if (this.musicPrimary) {
      await this.safeStopAndUnload(this.musicPrimary.sound);
      this.musicPrimary = null;
    }
    if (this.musicSecondary) {
      await this.safeStopAndUnload(this.musicSecondary.sound);
      this.musicSecondary = null;
    }
  }

  private async ensureAmbient() {
    if (!this.isAmbientOn) return;
    if (this.ambient) return;

    // TODO: add a loopable ambient waves file at AMBIENT_WAVES_ASSET.
    const ambientRef = await this.createSound(AMBIENT_WAVES_ASSET, this.ambientVolume, true);
    this.ambient = ambientRef;
    await ambientRef.sound.playAsync();
  }

  private async fadeOutAndStopAmbient() {
    if (!this.ambient) return;
    await this.fadeVolume(this.ambient.sound, this.ambientVolume, 0, 400);
    await this.safeStopAndUnload(this.ambient.sound);
    this.ambient = null;
  }

  private attachLoopWatcher(ref: SoundRef) {
    ref.sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (this.loopInProgress || this.isSwitching) return;
      if (!status.durationMillis) return;

      const remaining = status.durationMillis - status.positionMillis;
      if (remaining <= this.loopFadeMs + this.loopPreRollMs) {
        void this.loopCrossfade(ref);
      }
    });
  }

  private async loopCrossfade(ref: SoundRef) {
    if (this.loopInProgress) return;
    this.loopInProgress = true;

    const opId = ++this.operationId;

    try {
      const nextRef = await this.createSound(ref.asset, 0);
      if (opId !== this.operationId) {
        await nextRef.sound.unloadAsync();
        return;
      }

      this.musicSecondary = nextRef;
      await nextRef.sound.playAsync();

      await this.crossfadeMusic(nextRef, this.loopFadeMs, opId);
    } catch {
      // Fallback: restart same sound if next instance fails.
      try {
        await ref.sound.setPositionAsync(0);
      } catch {
        // No-op: if restart fails, keep the current sound.
      }
    } finally {
      if (opId === this.operationId) this.loopInProgress = false;
    }
  }

  private async crossfadeMusic(next: SoundRef, durationMs: number, opId: number) {
    const current = this.musicPrimary;
    this.musicPrimary = next;

    const fadeInPromise = this.fadeVolume(next.sound, 0, this.musicVolume, durationMs, opId);
    const fadeOutPromise = current
      ? this.fadeVolume(current.sound, this.musicVolume, 0, durationMs, opId)
      : Promise.resolve();

    await Promise.all([fadeInPromise, fadeOutPromise]);

    if (current) {
      await this.safeStopAndUnload(current.sound);
    }

    if (this.musicSecondary && this.musicSecondary !== this.musicPrimary) {
      await this.safeStopAndUnload(this.musicSecondary.sound);
      this.musicSecondary = null;
    }

    this.attachLoopWatcher(next);
  }

  private async createSound(asset: number, volume: number, isLooping = false): Promise<SoundRef> {
    const { sound } = await Audio.Sound.createAsync(
      asset,
      {
        volume: this.clamp01(volume),
        isLooping,
        progressUpdateIntervalMillis: 250,
      },
      undefined,
      true,
    );

    return { sound, asset };
  }

  private async fadeVolume(
    sound: Audio.Sound,
    from: number,
    to: number,
    durationMs: number,
    opId?: number,
  ) {
    const steps = Math.max(1, Math.floor(durationMs / this.fadeStepMs));
    const delta = (to - from) / steps;

    let current = from;
    for (let i = 0; i < steps; i += 1) {
      if (opId && opId !== this.operationId) return;
      current += delta;
      await sound.setVolumeAsync(this.clamp01(current));
      await this.wait(this.fadeStepMs);
    }

    await sound.setVolumeAsync(this.clamp01(to));
  }

  private async safeStopAndUnload(sound: Audio.Sound) {
    try {
      await sound.stopAsync();
    } catch {}
    try {
      await sound.unloadAsync();
    } catch {}
  }

  private clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async handleAppState(next: AppStateStatus) {
    if (this.appState === next) return;
    const prev = this.appState;
    this.appState = next;

    if (prev.match(/active/) && next.match(/inactive|background/)) {
      this.wasPlayingBeforeBackground = !!this.musicPrimary;
      await this.pauseAll();
      return;
    }

    if (prev.match(/inactive|background/) && next === "active") {
      if (this.wasPlayingBeforeBackground) {
        await this.resumeAll();
      }
      this.wasPlayingBeforeBackground = false;
    }
  }

  private async pauseAll() {
    if (this.musicPrimary) {
      try {
        await this.musicPrimary.sound.pauseAsync();
      } catch {}
    }
    if (this.musicSecondary) {
      try {
        await this.musicSecondary.sound.pauseAsync();
      } catch {}
    }
    if (this.ambient) {
      try {
        await this.ambient.sound.pauseAsync();
      } catch {}
    }
  }

  private async resumeAll() {
    if (this.musicPrimary) {
      try {
        await this.musicPrimary.sound.playAsync();
      } catch {}
    }
    if (this.musicSecondary) {
      try {
        await this.musicSecondary.sound.playAsync();
      } catch {}
    }
    if (this.ambient) {
      try {
        await this.ambient.sound.playAsync();
      } catch {}
    }
  }
}

export const focusAudioManager = new FocusAudioManager();
