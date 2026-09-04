describe('Playback Speed & Natural Audio Pitch Preservation', () => {
  const SPEED_MATRIX = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  class MockVideoPlayer {
    playbackRate = 1.0;
    preservesPitch = false;
    playbackParameters = { speed: 1.0, pitch: 1.0 };

    setPlaybackRate(speed: number) {
      this.playbackRate = speed;
      this.applyPitchCorrection();
    }

    setPreservesPitch(enabled: boolean) {
      this.preservesPitch = enabled;
      this.applyPitchCorrection();
    }

    // Mirrors expo-video Android VideoPlayer.kt logic:
    // private fun applyPitchCorrection(playbackParameters: PlaybackParameters): PlaybackParameters {
    //   val speed = playbackParameters.speed
    //   val pitch = if (preservesPitch) 1f else speed
    //   return PlaybackParameters(speed, pitch)
    // }
    private applyPitchCorrection() {
      const pitch = this.preservesPitch ? 1.0 : this.playbackRate;
      this.playbackParameters = { speed: this.playbackRate, pitch };
    }
  }

  it('VARSAYILAN (Kusurlu) DURUM: preservesPitch false iken 2.0x hızda ses perdesi (pitch) iki katına çıkar (sincap efekti)', () => {
    const player = new MockVideoPlayer();
    player.setPlaybackRate(2.0);
    // Beklenen kusurlu davranış: pitch de 2.0 olur
    expect(player.playbackParameters.pitch).toBe(2.0);
  });

  it('DÜZELTİLMİŞ DURUM: preservesPitch = true iken tüm hızlarda (0.5x - 2.0x) ses perdesi tam 1.0 kalır (doğal insan sesi)', () => {
    const player = new MockVideoPlayer();
    player.setPreservesPitch(true);

    for (const speed of SPEED_MATRIX) {
      player.setPlaybackRate(speed);
      expect(player.playbackRate).toBe(speed);
      expect(player.playbackParameters.speed).toBe(speed);
      // Ses perdesi 1.0 olarak sabitlenmeli, asla değişmemelidir!
      expect(player.playbackParameters.pitch).toBe(1.0);
    }
  });

  it('2x Turbo moduna basılı tutulduğunda ve bırakıldığında pitch doğruluğu korunur', () => {
    const player = new MockVideoPlayer();
    player.setPreservesPitch(true);
    player.setPlaybackRate(1.25); // Kullanıcı 1.25x dinliyordu

    // Uzun basma: 2x Turbo
    player.setPlaybackRate(2.0);
    expect(player.playbackParameters.speed).toBe(2.0);
    expect(player.playbackParameters.pitch).toBe(1.0);

    // Bırakma: Eski hıza dönüş
    player.setPlaybackRate(1.25);
    expect(player.playbackParameters.speed).toBe(1.25);
    expect(player.playbackParameters.pitch).toBe(1.0);
  });
});
