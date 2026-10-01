import type { Block, Lesson, Localized, Store } from "./types";
const l = (ru: string, kk: string): Localized => ({ ru, kk });
const text = (id: string, title: string, content: string): Block => ({
  id,
  type: "text",
  title,
  content,
});
const choice = (id: string, title: string, options: string[]): Block => ({
  id,
  type: "choice",
  title,
  content: "",
  options,
  points: 1,
});
const gap = (id: string, title: string): Block => ({
  id,
  type: "gap",
  title,
  content: "Write the missing word.",
  points: 1,
});
const writing = (id: string, title: string, content: string): Block => ({
  id,
  type: "writing",
  title,
  content,
  points: 5,
});
const picture = (id: string, url: string, title: string): Block => ({
  id,
  type: "image",
  title,
  content: "",
  url,
});
const audio = (id: string): Block => ({
  id,
  type: "audio",
  title: "Listen carefully",
  content: "Listen and write the sentences you hear.",
  url: "/audio/" + id + ".wav",
});
const lesson = (
  id: string,
  moduleId: string,
  position: number,
  title: Localized,
  description: Localized,
  blocks: Block[],
  keys: Record<string, string[]>,
): Lesson => ({
  id,
  moduleId,
  position,
  title,
  description,
  minutes: 15,
  published: true,
  attemptLimit: 2,
  version: 1,
  blocks,
  keys: Object.fromEntries(
    Object.entries(keys).map(([k, accepted]) => [k, { accepted }]),
  ),
});
export function createSeed(): Store {
  return {
    revision: 0,
    profiles: [
      {
        id: "student-demo",
        name: "Амина",
        email: "amina@example.com",
        role: "student",
        active: true,
      },
      {
        id: "student-two",
        name: "Данияр",
        email: "daniyar@example.com",
        role: "student",
        active: true,
      },
      {
        id: "teacher-demo",
        name: "Алия Сейтова",
        email: "aliya@example.com",
        role: "teacher",
        active: true,
      },
      {
        id: "admin-demo",
        name: "Администратор",
        email: "admin@example.com",
        role: "admin",
        active: true,
      },
    ],
    courses: [
      {
        id: "first-steps",
        title: "English. First steps",
        description: l(
          "Первые слова, маленькие открытия и уверенность в английском.",
          "Алғашқы сөздер, шағын жаңалықтар және ағылшын тіліне сенімділік.",
        ),
        level: "Beginner",
        teacherId: "teacher-demo",
        color: "mint",
      },
    ],
    modules: [
      {
        id: "hello",
        courseId: "first-steps",
        title: l("Давай знакомиться", "Танысайық"),
        position: 1,
      },
      {
        id: "school",
        courseId: "first-steps",
        title: l("Мой школьный мир", "Менің мектеп әлемім"),
        position: 2,
      },
    ],
    lessons: [
      lesson(
        "hello-name",
        "hello",
        1,
        l("Hello! Давай знакомиться", "Hello! Танысайық"),
        l(
          "Научимся здороваться и представляться.",
          "Амандасуды және өзімізді таныстыруды үйренеміз.",
        ),
        [
          text(
            "hello-rule",
            "A little conversation",
            "Hello! My name is Maya. What is your name?\nHi, Maya! My name is Alex.\nNice to meet you!",
          ),
          picture(
            "hello-picture",
            "/illustrations/hello.svg",
            "Hello, new friends!",
          ),
          choice("hello-c1", "You meet a new friend. What do you say?", [
            "Hello!",
            "Good night!",
            "Thank you!",
          ]),
          gap("hello-g1", "My ___ is Alex."),
          choice("hello-c2", "Choose a question about a name.", [
            "What is your name?",
            "How old are you?",
            "What colour is it?",
          ]),
          gap("hello-g2", "___ to meet you!"),
          writing(
            "hello-w1",
            "Introduce yourself",
            "Write one or two sentences. Tell us your name and say hello.",
          ),
        ],
        {
          "hello-c1": ["Hello!"],
          "hello-g1": ["name"],
          "hello-c2": ["What is your name?"],
          "hello-g2": ["nice"],
        },
      ),
      lesson(
        "numbers",
        "hello",
        2,
        l("Сколько тебе лет?", "Жасың нешеде?"),
        l(
          "Числа от 1 до 10 и разговор о возрасте.",
          "1-ден 10-ға дейінгі сандар және жас туралы әңгіме.",
        ),
        [
          text(
            "number-rule",
            "Count with me",
            "one · two · three · four · five\nsix · seven · eight · nine · ten\nHow old are you? I am seven.",
          ),
          choice("number-c1", "Which word means 8?", ["six", "eight", "ten"]),
          gap("number-g1", "2 + 3 = ___ (write a word)"),
          choice("number-c2", "Choose the question about age.", [
            "How old are you?",
            "What is your name?",
            "What is this?",
          ]),
          gap("number-g2", "I ___ nine."),
          writing(
            "number-w1",
            "About you",
            "Write your age in a full sentence.",
          ),
        ],
        {
          "number-c1": ["eight"],
          "number-g1": ["five"],
          "number-c2": ["How old are you?"],
          "number-g2": ["am"],
        },
      ),
      lesson(
        "colours",
        "hello",
        3,
        l("Мир в цвете", "Түстер әлемі"),
        l(
          "Называем цвета и описываем предметы.",
          "Түстерді атаймыз және заттарды сипаттаймыз.",
        ),
        [
          text(
            "colour-rule",
            "A colourful day",
            "red · yellow · blue · green · pink · purple · orange\nWhat colour is it? It is green.",
          ),
          picture(
            "colour-picture",
            "/illustrations/colours.svg",
            "Our colour palette",
          ),
          choice("colour-c1", "Look at the leaf. What colour is it?", [
            "green",
            "pink",
            "orange",
          ]),
          gap("colour-g1", "The sky is ___ (blue / red)."),
          choice("colour-c2", "Choose the colour of a yellow star.", [
            "purple",
            "yellow",
            "blue",
          ]),
          gap("colour-g2", "What ___ is it?"),
          writing(
            "colour-w1",
            "Your favourite colour",
            "Write about your favourite colour and one object of that colour.",
          ),
        ],
        {
          "colour-c1": ["green"],
          "colour-g1": ["blue"],
          "colour-c2": ["yellow"],
          "colour-g2": ["colour", "color"],
        },
      ),
      lesson(
        "school-things",
        "school",
        1,
        l("Что в моём портфеле?", "Менің сөмкемде не бар?"),
        l(
          "Знакомимся со школьными принадлежностями.",
          "Мектеп құралдарымен танысамыз.",
        ),
        [
          text(
            "school-rule",
            "Ready for school",
            "a pen · a pencil · a ruler · a rubber · a book\nA rubber is also called an eraser.",
          ),
          picture(
            "school-picture",
            "/illustrations/school.svg",
            "School things",
          ),
          choice("school-c1", "You use this to measure a line.", [
            "a book",
            "a ruler",
            "a rubber",
          ]),
          gap("school-g1", "You read a ___."),
          choice("school-c2", "Which object removes pencil marks?", [
            "a rubber",
            "a pen",
            "a book",
          ]),
          gap("school-g2", "p e n c _ l"),
          writing(
            "school-w1",
            "Pack your bag",
            "Write the names of three things in your school bag.",
          ),
        ],
        {
          "school-c1": ["a ruler"],
          "school-g1": ["book"],
          "school-c2": ["a rubber"],
          "school-g2": ["i"],
        },
      ),
      lesson(
        "whats-this",
        "school",
        2,
        l("What is this?", "What is this?"),
        l(
          "Учимся спрашивать о предмете и отвечать.",
          "Зат туралы сұрауды және жауап беруді үйренеміз.",
        ),
        [
          text(
            "this-rule",
            "Ask and answer",
            "What is this? It is a pencil.\nWhat’s = What is\nIt’s = It is",
          ),
          choice("this-c1", "Choose the complete sentence.", [
            "It is a ruler.",
            "Is ruler a.",
            "A ruler it.",
          ]),
          gap("this-g1", "It ___ a book."),
          choice("this-c2", "What is this?", [
            "It is a pen.",
            "I am eight.",
            "Hello, Alex!",
          ]),
          gap("this-g2", "It is ___ pencil."),
          writing(
            "this-w1",
            "Three little sentences",
            "Choose three school things. Write a sentence about each one.",
          ),
        ],
        {
          "this-c1": ["It is a ruler."],
          "this-g1": ["is"],
          "this-c2": ["It is a pen."],
          "this-g2": ["a"],
        },
      ),
      lesson(
        "dictation",
        "school",
        3,
        l("Слушаю, пишу, понимаю", "Тыңдаймын, жазамын, түсінемін"),
        l(
          "Мини-диктант и первое письменное задание.",
          "Шағын диктант және алғашқы жазбаша тапсырма.",
        ),
        [
          text(
            "dict-rule",
            "You can do it!",
            "Listen once. Then listen again and write what you hear. You can pause and replay the audio.",
          ),
          audio("dictation-a"),
          writing(
            "dict-w1",
            "Mini dictation",
            "Write the sentences you hear. Your teacher will check spelling and punctuation.",
          ),
          choice("dict-c1", "Which question asks about a colour?", [
            "What colour is it?",
            "How old are you?",
            "What is your name?",
          ]),
          gap("dict-g1", "My name ___ Sam."),
          writing(
            "dict-w2",
            "My school bag",
            "Write two sentences about a school thing and its colour.",
          ),
        ],
        { "dict-c1": ["What colour is it?"], "dict-g1": ["is"] },
      ),
    ],
    groups: [
      {
        id: "beginners",
        name: "Beginners · A",
        teacherId: "teacher-demo",
        studentIds: ["student-demo", "student-two"],
      },
    ],
    enrollments: [
      {
        id: "enrollment-demo",
        courseId: "first-steps",
        groupId: "beginners",
        mode: "group",
      },
    ],
    releases: [
      "hello-name",
      "numbers",
      "colours",
      "school-things",
      "whats-this",
      "dictation",
    ].map((lessonId, i) => ({
      id: "release-" + lessonId,
      lessonId,
      groupId: "beginners",
      homework: i === 0 || i === 5,
    })),
    notificationReads: [],
    drafts: [],
    attempts: [],
    extras: [],
  };
}
