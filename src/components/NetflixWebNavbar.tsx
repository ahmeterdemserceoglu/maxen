import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image as RNImage,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type Profile } from '@/types/profile';
import { useAuth } from '@/contexts/AuthContext';
import { useUiStore, TabKey } from '@/store/uiStore';

export interface NetflixWebNavbarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  activeProfile: Profile | null;
  onChangeProfile: () => void;
  onOpenDiscoveryHub: () => void;
  onOpenWatchParty: () => void;
  pendingFriendRequestsCount: number;
}

export function NetflixWebNavbar({
  activeTab,
  onSelectTab,
  activeProfile,
  onChangeProfile,
  onOpenDiscoveryHub,
  onOpenWatchParty,
  pendingFriendRequestsCount,
}: NetflixWebNavbarProps) {
  const { user, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks: { key: TabKey; label: string }[] = [
    { key: 'home', label: 'Ana Sayfa' },
    { key: 'tv', label: 'Diziler' },
    { key: 'movies', label: 'Filmler' },
    { key: 'media', label: 'Yeni & Popüler' },
    { key: 'social', label: 'Sosyal' },
    { key: 'search', label: 'Keşfet' },
  ];

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '68px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        backgroundColor: isScrolled ? 'rgba(20, 20, 20, 0.96)' : 'rgba(20, 20, 20, 0.25)',
        backdropFilter: isScrolled ? 'blur(16px)' : 'blur(4px)',
        WebkitBackdropFilter: isScrolled ? 'blur(16px)' : 'blur(4px)',
        boxShadow: isScrolled ? '0 4px 20px rgba(0, 0, 0, 0.7)' : 'none',
        transition: 'background-color 0.4s ease, box-shadow 0.4s ease',
      }}
    >
      {/* LEFT: Brand Logo & Navigation Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
        <button
          onClick={() => onSelectTab('home')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '26px',
              fontWeight: '900',
              color: '#E50914',
              letterSpacing: '3px',
              textShadow: '0 2px 10px rgba(229, 9, 20, 0.4)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            MAXEN
          </span>
        </button>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          {navLinks.map((link) => {
            const isActive = activeTab === link.key;
            return (
              <button
                key={link.key}
                onClick={() => {
                  if (link.key === 'search') {
                    onOpenDiscoveryHub();
                  } else {
                    onSelectTab(link.key);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isActive ? '#FFFFFF' : '#B3B3B3',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '6px 0',
                  position: 'relative',
                  transition: 'color 0.2s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#B3B3B3';
                }}
              >
                {link.label}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: '20%',
                      right: '20%',
                      height: '2px',
                      backgroundColor: '#E50914',
                      borderRadius: '1px',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* RIGHT: Search, Watch Party, Notifications, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Watch Party Button */}
        <button
          onClick={onOpenWatchParty}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(229, 9, 20, 0.15)',
            border: '1px solid rgba(229, 9, 20, 0.5)',
            color: '#FFFFFF',
            padding: '6px 14px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#E50914';
            e.currentTarget.style.transform = 'scale(1.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(229, 9, 20, 0.15)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Ionicons name="people" size={15} color="#FFFFFF" />
          <span>Birlikte İzle</span>
        </button>

        {/* Search Icon */}
        <button
          onClick={() => onSelectTab('search')}
          style={{
            background: 'none',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85,
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.85';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Keşfet / Ara"
        >
          <Ionicons name="search" size={20} color="#FFFFFF" />
        </button>

        {/* Notifications / Social Bell */}
        <button
          onClick={() => onSelectTab('social')}
          style={{
            background: 'none',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '6px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85,
            transition: 'opacity 0.2s ease',
          }}
          title="Bildirimler / Arkadaşlar"
        >
          <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
          {pendingFriendRequestsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                backgroundColor: '#E50914',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: '700',
                padding: '1px 5px',
                lineHeight: '12px',
              }}
            >
              {pendingFriendRequestsCount}
            </span>
          )}
        </button>

        {/* Profile Avatar & Dropdown */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setIsProfileDropdownOpen(true)}
          onMouseLeave={() => setIsProfileDropdownOpen(false)}
        >
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                backgroundColor: activeProfile?.color || '#E50914',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: '700',
                fontSize: '15px',
                overflow: 'hidden',
                border: '1.5px solid rgba(255,255,255,0.4)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {activeProfile?.avatarUrl ? (
                <img
                  src={activeProfile.avatarUrl}
                  alt={activeProfile.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                activeProfile?.letter || 'M'
              )}
            </div>
            <Ionicons
              name={isProfileDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={13}
              color="#FFFFFF"
            />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                width: '210px',
                backgroundColor: 'rgba(20, 20, 20, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.9)',
                padding: '8px 0',
                display: 'flex',
                flexDirection: 'column',
                backdropFilter: 'blur(20px)',
                zIndex: 1001,
              }}
            >
              <div
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: activeProfile?.color || '#E50914',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '13px',
                  }}
                >
                  {activeProfile?.letter || 'M'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {activeProfile?.name || 'Profil'}
                  </div>
                  <div
                    style={{
                      color: '#888',
                      fontSize: '11px',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {user?.email}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  onChangeProfile();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#D4D4D4',
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#D4D4D4';
                }}
              >
                <Ionicons name="people-outline" size={16} color="#aaa" />
                Profil Değiştir
              </button>

              <button
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  onSelectTab('settings');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#D4D4D4',
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#D4D4D4';
                }}
              >
                <Ionicons name="settings-outline" size={16} color="#aaa" />
                Hesap & Ayarlar
              </button>

              <div
                style={{
                  height: '1px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  margin: '4px 0',
                }}
              />

              <button
                onClick={async () => {
                  setIsProfileDropdownOpen(false);
                  await signOut();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                Oturumu Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default NetflixWebNavbar;
