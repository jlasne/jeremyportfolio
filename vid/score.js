/* placeholder score: four on the floor, replaced once the cue sheet lands */
ReelAudio.score = S => {
  for (let b = 0; b < 32; b++) { S.kick(b * S.BEAT); S.hat(b * S.BEAT + S.BEAT / 2); }
};
