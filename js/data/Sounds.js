// One entry per sound. To add a sound: drop the file in /audio and add a line here.
//   file      path to the audio file
//   volume    0..1 base volume
//   pitchVar  random pitch spread, 0.1 = +/-10% (keeps repeats from sounding robotic)
//   cooldown  min seconds between plays of this sound (anti-spam)
//   maxVoices max copies playing at once
//   bus       'sfx' | 'ui' | 'music'
const SOUND_DATA = {
    laser:          { file: 'audio/freesound_community-laser-45816.mp3',    volume: 0.20, pitchVar: 0.25, cooldown: 0.00, maxVoices: 12, bus: 'sfx' },
    planet_capture: { file: 'audio/planet_capture.wav',                     volume: 0.50, pitchVar: 0.00, cooldown: 0.20, maxVoices: 2, bus: 'sfx' },
    ui_click:       { file: 'audio/ui_click.wav',                           volume: 0.50, pitchVar: 0.00, cooldown: 0.03, maxVoices: 2, bus: 'ui'  }
};