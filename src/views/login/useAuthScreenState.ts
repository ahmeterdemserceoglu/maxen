import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import {
  type Profile,
  PROFILE_COLORS,
} from '@/types/profile';
import {
  createProfile,
  updateProfile,
  deleteProfile,
} from '@/services/profileService';

export type Screen =
  | 'auth'
  | 'forgot'
  | 'profiles'
  | 'manage'
  | 'edit'
  | 'pin_verify';

export function useAuthScreenState() {
  const {
    user,
    profiles,
    profilesLoading,
    signIn,
    signUp,
    resetPassword,
    selectProfile,
    refreshProfiles,
    signInWithTvSession,
    authError,
    clearAuthError,
  } = useAuth();

  const [screen, setScreen] = useState<Screen>('auth');
  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Profile Edit / Create
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PROFILE_COLORS[0]);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editIsKids, setEditIsKids] = useState(false);
  const [editPin, setEditPin] = useState('');

  const [newProfileName, setNewProfileName] = useState('');
  const [newIsKids, setNewIsKids] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(null);

  // PIN
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [enteredPin, setEnteredPin] = useState('');

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const logoGlowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const logoGlowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlowAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(logoGlowAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );

    floatAnimation.start();
    pulseAnimation.start();
    logoGlowAnimation.start();

    return () => {
      floatAnimation.stop();
      pulseAnimation.stop();
      logoGlowAnimation.stop();
    };
  }, [floatAnim, pulseAnim, logoGlowAnim]);

  useEffect(() => {
    if (user && screen === 'auth') {
      setScreen('profiles');
    }
  }, [user, screen]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 12,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -12,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  const handleAuth = async () => {
    clearAuthError();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('E-posta ve şifre gereklidir.');
      triggerShake();
      return;
    }

    if (isRegister && !displayName.trim()) {
      setLocalError('Profil adı gereklidir.');
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        await signUp(
          email.trim(),
          password,
          displayName.trim(),
        );
      } else {
        await signIn(
          email.trim(),
          password,
        );
      }

      setScreen('profiles');
    } catch {
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    clearAuthError();
    setLocalError(null);

    if (!resetEmail.trim()) {
      setLocalError('Lütfen e-posta adresinizi girin.');
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      await resetPassword(resetEmail.trim());
      setResetSent(true);
    } catch {
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = (profile: Profile) => {
    setLocalError(null);

    if (profile.pin) {
      setTargetProfile(profile);
      setEnteredPin('');
      setScreen('pin_verify');
    } else {
      selectProfile(profile);
    }
  };

  const handlePinVerify = async (pinValue: string) => {
    if (!targetProfile) return;

    if (pinValue === targetProfile.pin) {
      await selectProfile(targetProfile);

      setTargetProfile(null);
      setEnteredPin('');
    } else {
      setLocalError('Hatalı PIN kodu.');
      setEnteredPin('');
      triggerShake();
    }
  };

  const handleCreateProfile = async () => {
    if (!user || !newProfileName.trim()) return;

    setLoading(true);

    try {
      await createProfile(
        user.uid,
        newProfileName.trim(),
        undefined,
        newIsKids,
        newPin.trim().length === 4
          ? newPin.trim()
          : undefined,
        newAvatarUrl ?? undefined,
      );

      setNewProfileName('');
      setNewIsKids(false);
      setNewPin('');
      setNewAvatarUrl(null);

      await refreshProfiles();
    } catch (e: any) {
      setLocalError(e.message);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setEditName(profile.name);
    setEditColor(profile.color);
    setEditAvatarUrl(profile.avatarUrl ?? null);
    setEditIsKids(profile.isKids ?? false);
    setEditPin(profile.pin ?? '');
    setScreen('edit');
  };

  const handleSaveEdit = async () => {
    if (!user || !editingProfile || !editName.trim()) {
      return;
    }

    setLoading(true);

    try {
      await updateProfile(
        user.uid,
        editingProfile.id,
        {
          name: editName.trim(),
          color: editColor,
          isKids: editIsKids,
          pin:
            editPin.trim().length === 4
              ? editPin.trim()
              : null,
          avatarUrl: editAvatarUrl,
        },
      );

      await refreshProfiles();

      setEditingProfile(null);
      setScreen('manage');
    } catch (e: any) {
      setLocalError(e.message);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (profile: Profile) => {
    if (!user) return;

    setLoading(true);

    try {
      await deleteProfile(
        user.uid,
        profile.id,
      );

      await refreshProfiles();
    } catch (e: any) {
      setLocalError(e.message);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const errorMessage = localError || authError;

  return {
    user,
    profiles,
    profilesLoading,
    screen,
    setScreen,
    isRegister,
    setIsRegister,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    resetEmail,
    setResetEmail,
    resetSent,
    setResetSent,
    loading,
    localError,
    setLocalError,
    errorMessage,
    clearAuthError,

    // Profile Edit
    editingProfile,
    setEditingProfile,
    editName,
    setEditName,
    editColor,
    setEditColor,
    editAvatarUrl,
    setEditAvatarUrl,
    editIsKids,
    setEditIsKids,
    editPin,
    setEditPin,
    handleStartEditProfile,
    handleSaveEdit,

    // Profile Create
    newProfileName,
    setNewProfileName,
    newIsKids,
    setNewIsKids,
    newPin,
    setNewPin,
    newAvatarUrl,
    setNewAvatarUrl,
    handleCreateProfile,

    // Profile Delete
    handleDeleteProfile,

    // Profile PIN & Click
    targetProfile,
    setTargetProfile,
    enteredPin,
    setEnteredPin,
    handleProfileClick,
    handlePinVerify,

    // Auth actions
    handleAuth,
    handleResetPassword,
    signInWithTvSession,

    // Animations
    floatAnim,
    pulseAnim,
    shakeAnim,
    logoGlowAnim,
    triggerShake,
  };
}
