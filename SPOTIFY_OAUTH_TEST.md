# 🔧 Guide de diagnostic Spotify OAuth - FlowApp

## ✅ Correctifs appliqués

### 1. **Fan-out openURL corrigé** (Critique)
**Avant:**
```objc
// ❌ BUG: Spotify mange la callback, RN ne la reçoit jamais
if (handledBySpotify) { return YES; }
return [RCTLinkingManager ...];
```

**Après:**
```objc
// ✅ Les DEUX handlers reçoivent l'URL (pattern recommandé du guide)
BOOL handledByRN = [RCTLinkingManager application:application openURL:url options:options];
BOOL handledBySpotify = [[RNSpotifyRemoteAuth sharedInstance] application:application openURL:url options:options];
return handledByRN || handledBySpotify;
```

### 2. **Logs de diagnostic natifs ajoutés**
- `NSLog("[SPOTIFY_OAUTH] openURL called: %@", url)` (iOS)
- `NSLog("[SPOTIFY_OAUTH] Handled by RN: %d, Spotify: %d", ...)` (iOS)
- `print("[SPOTIFY_OAUTH] openURL called: ...")` (iOS Swift)
- Console logs `[DL_DIAG]` côté JavaScript

### 3. **Support Universal Links** (`continueUserActivity`)
Ajouté dans AppDelegate (Obj-C) et AppDelegate (Swift) avec fan-out identique.

### 4. **Support SceneDelegate** (iOS 13+)
- `scene(_:openURLContexts:)` pour schémas custom
- `scene(_:continue:)` pour Universal Links
- Fan-out vers RN + Spotify dans les deux cas

### 5. **Robustesse JS Linking améliorée**
- Écoute `addEventListener('url')` ET `getInitialURL()` (app tuée vs chaude)
- Avertissement si Remote JS Debugging est actif

---

## 🧪 Checklist de test (simulateur + device)

### P0 - Test de base (schéma custom)

#### Sur simulateur iOS:
```bash
# 1. Démarrer l'app
npx expo start --dev-client -c

# 2. Dans un autre terminal, tester le deep link
xcrun simctl openurl booted "flusso://spotify-auth?code=test123&state=xyz"
```

**Logs attendus:**
```
[SPOTIFY_OAUTH] openURL called: flusso://spotify-auth?code=test123&state=xyz
[SPOTIFY_OAUTH] Handled by RN: 1, Spotify: 1
[DL_DIAG] ✅ url event caught: flusso://spotify-auth?code=test123&state=xyz
[DL_DIAG] ✅ Spotify redirect caught by Linking listener!
```

**Si échec:**
- ❌ `flusso` manquant dans CFBundleURLTypes → vérifier que le plugin est dans `app.json`
- ❌ Pas de logs `[SPOTIFY_OAUTH]` → AppDelegate/SceneDelegate pas patché (rebuild nécessaire)

---

### P0 - Test OAuth réel (appareil physique recommandé)

**Pré-requis:**
1. ✅ App Spotify installée sur device iOS
2. ✅ `flusso://spotify-auth` dans "Redirect URIs" du [Spotify Dashboard](https://developer.spotify.com/dashboard)
3. ✅ Client ID `f95c8effcc63427e8b98c6a92a9d0c17` correspond au Dashboard

**Procédure:**
1. Lancer l'app sur device via EAS dev build
2. Appuyer sur le bouton Spotify Connect
3. L'app Spotify s'ouvre → accepter les permissions
4. L'app FlowApp devrait reprendre focus

**Logs attendus (XCode Console):**
```
🎵 Calling auth.authorize...
[SPOTIFY_OAUTH] openURL called: flusso://spotify-auth?code=AQCe...&state=...
[SPOTIFY_OAUTH] Handled by RN: 1, Spotify: 1
[DL_DIAG] ✅ url event caught: flusso://spotify-auth?code=...
✅ Authorization successful! Deep link was caught, got token
🎵 Calling remote.connect...
🎵 Connected successfully!
```

**Logs d'erreur (avant correctifs):**
```
❌ TIMEOUT: Deep link was never caught by the app
❌ This means AppDelegate.openURL handler is missing or not working
Authorization timeout after 60 seconds
```

---

### P1 - Test "app tuée" vs "app chaude"

**Test 1: App chaude (déjà ouverte)**
```bash
xcrun simctl openurl booted "flusso://spotify-auth?probe=hot"
```
✅ Devrait voir: `[DL_DIAG] ✅ url event caught: ...`

**Test 2: App tuée**
1. Kill l'app (swipe up)
2. Exécuter: `xcrun simctl openurl booted "flusso://spotify-auth?probe=cold"`
3. L'app s'ouvre

✅ Devrait voir: `[DL_DIAG] ✅ initialURL (app was killed): flusso://spotify-auth?probe=cold`

**Piège Remote JS Debugging:**
- ⚠️ Si vous avez "Remote JS Debugging" activé, `getInitialURL()` retourne toujours `null`
- Solution: désactiver Remote JS Debugging pendant les tests OAuth

---

### P2 - Vérifier App Transport Security (si token swap/refresh)

Si vous utilisez `tokenSwapURL` / `tokenRefreshURL` en HTTP (dev):

**Info.plist devrait contenir:**
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSExceptionDomains</key>
  <dict>
    <key>localhost</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
    </dict>
  </dict>
</dict>
```

**Actuellement:** Vous utilisez `tokenSwapURL: ""` → pas de swap, donc ATS n'est pas un problème.

---

## 📋 Configuration Spotify Dashboard

### ✅ Redirect URIs configurés:
Ajoutez exactement (respecter majuscules/minuscules):
```
flusso://spotify-auth
```

### ⚠️ Règles iOS Spotify (à respecter):
- ✅ Tout en minuscules: `flusso` (OK)
- ✅ Préfixe unique non générique: `flusso` (OK, pas juste "app" ou "my-app")
- ✅ Schéma dédié: `flusso://spotify-auth` (OK)
- ✅ Chemin après `://`: `/spotify-auth` (OK)

### 🔒 Sécurité 2025+:
- ✅ Schémas custom supportés (ce que vous utilisez)
- 💡 Recommandé: Universal Links (`https://flusso.app/spotify-callback`)
  - Nécessite domaine + fichier AASA
  - Si besoin, voir section "Migration Universal Links" du guide

---

## 🏗️ Rebuild nécessaire

**Les changements natifs (AppDelegate/SceneDelegate) nécessitent un rebuild:**

```bash
# iOS (EAS dev build)
eas build --platform ios --profile development

# Ou local si Xcode + Dev Client setup:
cd ios && pod install && cd ..
npx expo run:ios --device
```

**Après rebuild:**
1. Installer le nouveau `.ipa` sur appareil
2. Relancer les tests P0 + P1

---

## 🔍 Filtrer les logs iOS (Terminal)

**Pendant un test sur simulateur:**
```bash
xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "SPOTIFY"'
```

**Sur device physique (XCode):**
1. Window → Devices and Simulators
2. Sélectionner votre device
3. View Device Logs
4. Filtrer: `SPOTIFY_OAUTH` ou `DL_DIAG`

---

## 🐛 Matrice de troubleshooting

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| ✅ `redirect caught by Linking` puis ❌ `timeout after 60s` | Fan-out manquant: RN reçoit mais pas Spotify SDK | ✅ **APPLIQUÉ** - Fan-out OR dans openURL |
| ❌ `Deep link never caught` + app s'ouvre bien | Listener attaché trop tard, ou Remote Debug actif | Désactiver Remote Debug; listener installé dans useEffect (✅ OK) |
| `AppDelegate.openURL handler missing` | SceneDelegate utilisé mais pas patché | ✅ **APPLIQUÉ** - SceneDelegate handlers ajoutés |
| Safari s'ouvre au lieu de l'app (Universal Link) | AASA mal configuré ou absent | N/A (vous utilisez schéma custom) |
| `INVALID_CLIENT` / `Insecure redirect` | Redirect non autorisé dans Dashboard | Vérifier Dashboard: `flusso://spotify-auth` exact |
| Fonctionne en build, échoue en Expo Go | Expo Go: schéma non stable pour OAuth | ✅ Utiliser dev build (instructions dans hook) |

---

## 📦 Prochaines étapes recommandées

### Si le problème persiste après rebuild:

1. **Vérifier Dashboard Spotify**
   - [ ] Client ID correspond: `f95c8effcc63427e8b98c6a92a9d0c17`
   - [ ] Redirect URI exact: `flusso://spotify-auth`
   - [ ] Pas d'espace/majuscule parasite

2. **Tester sur appareil physique**
   - Le simulateur ne peut pas installer l'app Spotify
   - Testez avec l'app Spotify réelle sur iPhone

3. **Logs complets**
   - Capturer les logs XCode pendant le flux OAuth
   - Chercher les lignes `[SPOTIFY_OAUTH]` et `[DL_DIAG]`
   - Partager si besoin de debug supplémentaire

4. **Migration Universal Links** (optionnel, recommandé pour production)
   - Domaine: `https://flusso.app/spotify-callback`
   - Nécessite: Associated Domains entitlement + AASA
   - Avantage: sécurité renforcée, pas de collision schéma

---

## ✅ Résumé des fichiers modifiés

1. **app.plugin.js**
   - L71-90: Fan-out openURL (Obj-C) avec `|| handledBySpotify`
   - L96-125: Fan-out openURL + continueUserActivity (Swift)
   - L147-189: SceneDelegate handlers (openURLContexts + continue)
   - Logs `NSLog`/`print` ajoutés partout

2. **src/hooks/useSpotifyRemote.ts**
   - L127-149: Logs `[DL_DIAG]` améliorés
   - Avertissement Remote JS Debugging
   - Listener 'url' + getInitialURL() (pattern recommandé guide)

3. **android/app/src/main/java/com/BLGgroup/flusso/MainActivity.kt**
   - L23-26: `onNewIntent` (✅ déjà présent, OK)

---

**Auteur:** Correctifs basés sur "Diagnostic et correction d'un timeout de redirection OAuth Spotify sur iOS avec React Native" (guide complet fourni par l'utilisateur)
