import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { isFirebaseConfigured } from '@/config/firebase';

import {
  AuthForm,
  ForgotPasswordModal,
  ProfileListScreen,
  ProfileEditModal,
  PinVerifyModal,
  useAuthScreenState,
} from './login';

export type { Profile } from '@/types/profile';

export function LoginView() {
  const {
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
  } = useAuthScreenState();

  useEffect(() => {
    if (!Platform.isTV || screen === 'profiles' || screen === 'auth') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen(screen === 'forgot' ? 'auth' : screen === 'edit' ? 'manage' : 'profiles');
      setLocalError(null);
      return true;
    });
    return () => sub.remove();
  }, [screen, setScreen, setLocalError]);

  if (!isFirebaseConfigured()) {
    return (
      <View style={[styles.rootBackground, styles.centerAll]}>
        <Ionicons
          name="warning-outline"
          size={48}
          color="#B8D2EA"
        />

        <ThemedText
          type="title"
          style={styles.cardTitle}
        >
          Firebase Yapılandırması Gerekli
        </ThemedText>

        <ThemedText style={styles.cardSubtitle}>
          src/config/firebase.ts dosyasındaki Firebase bilgilerinizi doldurun.
        </ThemedText>
      </View>
    );
  }



  // 1. Forgot password
  if (screen === 'forgot') {
    return (
      <ForgotPasswordModal
        resetEmail={resetEmail}
        onChangeResetEmail={setResetEmail}
        resetSent={resetSent}
        onResetSentChange={setResetSent}
        onSubmit={handleResetPassword}
        onBackToAuth={() => {
          clearAuthError();
          setLocalError(null);
          setScreen('auth');
        }}
        loading={loading}
        errorMessage={errorMessage}
        floatAnim={floatAnim}
        shakeAnim={shakeAnim}
      />
    );
  }

  // 2. Auth / Sign In / Sign Up
  if (!user || screen === 'auth') {
    return (
      <AuthForm
        isRegister={isRegister}
        onToggleRegister={() => {
          setIsRegister(!isRegister);
          clearAuthError();
          setLocalError(null);
        }}
        displayName={displayName}
        onChangeDisplayName={setDisplayName}
        email={email}
        onChangeEmail={setEmail}
        password={password}
        onChangePassword={setPassword}
        onSubmit={handleAuth}
        onForgotPassword={() => {
          setResetEmail(email);
          clearAuthError();
          setLocalError(null);
          setScreen('forgot');
        }}
        loading={loading}
        errorMessage={errorMessage}
        floatAnim={floatAnim}
        pulseAnim={pulseAnim}
        shakeAnim={shakeAnim}
        logoGlowAnim={logoGlowAnim}
        onTvAuthenticated={async (authData) => {
          if (authData?.userId) {
            try {
              await signInWithTvSession({
                userId: authData.userId,
                userEmail: authData.userEmail,
                userDisplayName: authData.userDisplayName,
                profileId: authData.profileId,
                code: authData.code,
                profiles: authData.profiles,
              });
            } catch (e) {
              console.warn('TV Auth failed:', e);
            }
          }
        }}
      />
    );
  }

  // 3. PIN Verification
  if (screen === 'pin_verify' && targetProfile) {
    return (
      <PinVerifyModal
        targetProfile={targetProfile}
        enteredPin={enteredPin}
        onChangeEnteredPin={setEnteredPin}
        onVerifyPin={handlePinVerify}
        onCancel={() => {
          setTargetProfile(null);
          setEnteredPin('');
          setLocalError(null);
          setScreen('profiles');
        }}
        errorMessage={errorMessage}
        shakeAnim={shakeAnim}
      />
    );
  }

  // 4. Edit Profile
  if (screen === 'edit' && editingProfile) {
    return (
      <ProfileEditModal
        editingProfile={editingProfile}
        editName={editName}
        onChangeEditName={setEditName}
        editColor={editColor}
        onChangeEditColor={setEditColor}
        editAvatarUrl={editAvatarUrl}
        onChangeEditAvatarUrl={setEditAvatarUrl}
        editIsKids={editIsKids}
        onChangeEditIsKids={setEditIsKids}
        editPin={editPin}
        onChangeEditPin={setEditPin}
        onSave={handleSaveEdit}
        onCancel={() => {
          setEditingProfile(null);
          setScreen('manage');
        }}
        loading={loading}
        errorMessage={errorMessage}
      />
    );
  }

  // 5. Manage Profiles
  if (screen === 'manage') {
    return (
      <ProfileListScreen
        profiles={profiles}
        isManageMode={true}
        onSelectProfile={handleProfileClick}
        onStartEditProfile={handleStartEditProfile}
        onDeleteProfile={handleDeleteProfile}
        onToggleManageMode={(manage) => {
          setLocalError(null);
          setScreen(manage ? 'manage' : 'profiles');
        }}
        newProfileName={newProfileName}
        onChangeNewProfileName={setNewProfileName}
        newIsKids={newIsKids}
        onChangeNewIsKids={setNewIsKids}
        newPin={newPin}
        onChangeNewPin={setNewPin}
        onCreateProfile={handleCreateProfile}
        errorMessage={errorMessage}
      />
    );
  }

  // 6. Profiles Picker (Default)
  return (
    <ProfileListScreen
      profiles={profiles}
      profilesLoading={profilesLoading}
      isManageMode={false}
      onSelectProfile={handleProfileClick}
      onStartEditProfile={handleStartEditProfile}
      onDeleteProfile={handleDeleteProfile}
      onToggleManageMode={(manage) => {
        setLocalError(null);
        setScreen(manage ? 'manage' : 'profiles');
      }}
      newProfileName={newProfileName}
      onChangeNewProfileName={setNewProfileName}
      newIsKids={newIsKids}
      onChangeNewIsKids={setNewIsKids}
      newPin={newPin}
      onChangeNewPin={setNewPin}
      onCreateProfile={handleCreateProfile}
      errorMessage={errorMessage}
    />
  );
}

const styles = StyleSheet.create({
  rootBackground: {
    flex: 1,
    backgroundColor: '#02060D',
  },
  centerAll: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9CA8B5',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 21,
  },
});
