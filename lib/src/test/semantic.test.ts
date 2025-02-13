import test from "ava";
import { Dolos } from "../dolos";
import { File } from "../lib/file/file";

test("equal content should match on the module level", async t => {
  const dolos = new Dolos({ semantic: true, semanticMatchLength: 10 });
  const content = `

  function hello() {
    return "hello";
  }

  const world = () => "world";

  function helloWorld() {
    console.log(hello() + " " + world())
  }
  `;

  const report = await dolos.analyze(
    [
      new File("file1", content),
      new File("file2", content),
    ]
  );

  t.deepEqual(report.semanticResults, [
    {
      left: 0,
      right: 1,
      childrenTotal: 32,
      occurrences: [
        2, 1, 3, 4,
        5, 7, 8, 6
      ],
      ownNodes: [],
      childrenMatch: 32
    },
    {
      left: 1,
      right: 0,
      childrenTotal: 32,
      occurrences: [
        2, 1, 3, 4,
        5, 7, 8, 6
      ],
      ownNodes: [],
      childrenMatch: 32
    }
  ]
  );
});
