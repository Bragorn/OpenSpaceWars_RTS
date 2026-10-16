// One entry per sound. To add a sound: drop the file in /audio and add a line here.
//   file      path to the audio file
//   volume    0..1 base volume
//   pitchVar  random pitch spread, 0.1 = +/-10% (keeps repeats from sounding robotic)
//   cooldown  min seconds between plays of this sound (anti-spam)
//   maxVoices max copies playing at once
//   bus       'sfx' | 'ui' | 'music'
const SOUND_DATA = {
    laser:          { file: 'audio/laserShoot (3).wav',   volume: 0.10, pitchVar: 0.05, cooldown: 0.00, maxVoices: 8, bus: 'sfx' },
    planet_capture: { file: 'audio/',                     volume: 0.50, pitchVar: 0.05, cooldown: 0.00, maxVoices: 2, bus: 'sfx' },
    ui_hover:       { file: 'audio/uiHover.wav',          volume: 0.25, pitchVar: 0.00, cooldown: 0.00, maxVoices: 2, bus: 'ui'  }
};