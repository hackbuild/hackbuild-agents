// ---------- what he says out loud: every fixed line, in one file ----------
// In-world speech, a man talking to his dog in his yard: short, plain and warm. These lines may
// use exclamation marks as the original did (owner decision, 2026-11-25); tools/voice-rules.mjs
// exempts this file from the exclamation rule only, and no UI copy lives here. Each list keeps
// its length, so a seeded day draws the same index as before.
const H_LINES = {
  throw: ['Go get it!', 'Fetch!', 'Ok one more. Go!', 'Go on, bud.', 'Get it get it get it'],
  praise: ['Good boy!', 'Yes! Good dog.', 'That is my dog!', 'There you go. Good boy.', 'Yes. Smart dog.', 'Who is a good boy? You are!', 'Yes! Yes! Good job buddy.', 'What a good boy.'],
  no: ['Nope.', 'Ah ah. Not that one.', 'Not that. Try again.', 'Almost.'],
  pet: ['Right there, huh?', 'Love you buddy.', 'Ok ok, scratches.', 'Look at you.'],
  feed: ['Dinner time buddy.', 'Bowl is full, go eat.'],
  chat: ['Hey you.', 'Come here, you.', 'You hungry?', 'You tired, bud?', 'What are you looking at?', 'Nice out today.'],
  trainStart: ['Alright, training time.', 'Ok, eyes on me.', "Let's learn something new."],
  trainDone: ['Ok, that is enough for today.', 'All done. Good work.', 'Good session buddy.'],
  fetchDone: ['Ok buddy, break time.', 'That is enough fetch for now.', 'My arm is done.'],
  leave: ['Be right back buddy.', 'Ok, I gotta run. Back soon.', "Watch the yard, I'll be back."],
  back: ["I'm back.", "Hey buddy, I'm home.", 'Missed you.'],
  sitBall: ["Later, bud. I'm sitting.", "Leave it there, I'll get it in a bit."],
  point: ['Over there.', 'Look. There.', 'It is right there bud'],
  bark: ['What?', 'Easy. Easy.', 'I hear you.', 'What is it buddy?'],
  missed: 'Come on buddy'
};
