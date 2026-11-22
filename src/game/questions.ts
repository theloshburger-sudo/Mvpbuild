export interface Question {
  prompt: string
  answer: string
}

// Real answers only. Players write convincing fakes; the truth gets mixed in.
export const QUESTIONS: Question[] = [
  // Words
  { prompt: 'What does the word "petrichor" mean?', answer: 'The smell of rain on dry earth' },
  { prompt: 'What does the Japanese word "tsundoku" describe?', answer: 'Buying books and never reading them' },
  { prompt: 'What does the Welsh word "hiraeth" mean?', answer: "A longing for a home you can't return to" },
  { prompt: 'What does the Japanese word "komorebi" mean?', answer: 'Sunlight filtering through trees' },
  { prompt: 'What is "kintsugi"?', answer: 'Repairing broken pottery with gold' },
  { prompt: 'What is an "aglet"?', answer: 'The plastic tip of a shoelace' },
  { prompt: 'What is a "philtrum"?', answer: 'The groove between your nose and upper lip' },
  { prompt: 'What is a "ferrule" on a pencil?', answer: 'The metal band that holds the eraser' },
  { prompt: 'What is an "interrobang"?', answer: 'A punctuation mark combining ? and !' },
  { prompt: 'What is a "tittle"?', answer: 'The dot over a lowercase i or j' },
  { prompt: 'What is an "obelus"?', answer: 'The division symbol ÷' },
  { prompt: 'What is a "lunula"?', answer: 'The half-moon at the base of a fingernail' },
  { prompt: 'What is a "zarf"?', answer: 'A holder for a handle-less hot coffee cup' },
  { prompt: 'What is a "vomitorium" in ancient Rome?', answer: 'A passage in an amphitheater for crowds to exit' },
  { prompt: 'What is a "mondegreen"?', answer: 'A misheard song lyric' },
  { prompt: 'What is a "spoonerism"?', answer: 'Swapping the starting sounds of two words' },
  { prompt: 'What is a "gongoozler"?', answer: 'Someone who enjoys watching canal boats' },
  { prompt: 'What does "borborygmus" refer to?', answer: 'Rumbling in your stomach' },
  { prompt: 'What is an "ultracrepidarian"?', answer: 'Someone who gives opinions on things they know nothing about' },
  { prompt: 'What is a "snollygoster"?', answer: 'A shrewd, unprincipled person, especially a politician' },
  { prompt: 'What does "floccinaucinihilipilification" mean?', answer: 'Estimating something as worthless' },
  { prompt: 'What does "crepuscular" describe?', answer: 'Animals active at twilight' },
  { prompt: 'What is a "bezoar"?', answer: 'A mass of indigestible material in the stomach' },
  { prompt: 'What does a "sphygmomanometer" measure?', answer: 'Blood pressure' },
  { prompt: 'What is the fear of long words officially called?', answer: 'Hippopotomonstrosesquippedaliophobia' },

  // Animals
  { prompt: 'What is a group of flamingos called?', answer: 'A flamboyance' },
  { prompt: 'What is a group of ferrets called?', answer: 'A business' },
  { prompt: 'What is a group of porcupines called?', answer: 'A prickle' },
  { prompt: 'What is a group of owls called?', answer: 'A parliament' },
  { prompt: 'What shape is wombat poop?', answer: 'Cubes' },
  { prompt: 'How many hearts does an octopus have?', answer: 'Three' },
  { prompt: "What is Scotland's national animal?", answer: 'The unicorn' },

  // Origins of names
  { prompt: 'What was Pepsi originally called?', answer: "Brad's Drink" },
  { prompt: 'What was Google originally called?', answer: 'Backrub' },
  { prompt: 'What was Amazon originally called?', answer: 'Cadabra' },
  { prompt: 'What was the Twitter bird originally named, after a basketball legend?', answer: 'Larry' },
  { prompt: 'Nintendo was founded in 1889 to make what?', answer: 'Playing cards' },
  { prompt: 'What does the name "LEGO" come from?', answer: 'Danish "leg godt", meaning "play well"' },
  { prompt: 'What was the tech company Adobe named after?', answer: "A creek behind the founder's house" },
  { prompt: 'What is Bluetooth named after?', answer: 'A Viking king' },
  { prompt: 'What is the name of the Monopoly mascot?', answer: 'Rich Uncle Pennybags' },
  { prompt: 'What does the "S" in Harry S. Truman stand for?', answer: 'Nothing' },
  { prompt: 'What does the "D" in D-Day stand for?', answer: 'Day' },

  // Odd facts
  { prompt: 'What was the first item ever sold on eBay?', answer: 'A broken laser pointer' },
  { prompt: 'What was the first toy ever advertised on TV?', answer: 'Mr. Potato Head' },
  { prompt: 'Which country has the most time zones, counting its territories?', answer: 'France' },
  { prompt: 'Which letter appears in no US state name?', answer: 'Q' },
  { prompt: 'Which US state has the most active volcanoes?', answer: 'Alaska' },
  { prompt: 'Which planet has a day longer than its year?', answer: 'Venus' },
  { prompt: 'Which is the only national flag that is not a rectangle or square?', answer: 'Nepal' },
  { prompt: 'Which two elements are liquid at room temperature?', answer: 'Mercury and bromine' },
  { prompt: 'What is the smallest bone in the human body?', answer: 'The stapes, in the ear' },
  { prompt: 'In botany, a banana is classified as a what?', answer: 'A berry' },
  { prompt: 'The shortest war in history lasted about how long?', answer: 'About 40 minutes' },
  { prompt: 'Which US president once held a license to run a tavern?', answer: 'Abraham Lincoln' },
  { prompt: 'How many dots are on a standard pair of dice, in total?', answer: '42' },
]
