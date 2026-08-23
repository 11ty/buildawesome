import test from "ava";
import Eleventy from "../src/Core.js";

test("#3808 addCollection in buildawesome.before", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addTemplate("post1.md", "# Post1");
      $config.addTemplate("post2.md", "# Post2");
      $config.addTemplate("index.njk", "{{ collections.posts.length }}");

      $config.on("buildawesome.before", async () => {
        $config.addCollection("posts", async collectionApi => {
          return collectionApi.getFilteredByGlob("**/post*.md");
        });
      })
    }
  });

  let result = await elev.toJSON();

  t.is(result.filter((entry) => entry.url === "/")[0]?.content.trim(), "2")
});

// /* broken */
// export default function($config) {
//   $config.on("buildawesome.before", async () => {
//     $config.addCollection("posts", collectionApi => {
//       return collectionApi.getFilteredByGlob("**/post*.md");
//     });
//   })
// }

// /* works */
// export default function($config) {
//   $config.on("buildawesome.beforeConfig", async ($config) => {
//     $config.addCollection("posts", collectionApi => {
//       return collectionApi.getFilteredByGlob("**/post*.md");
//     });
//   })
// }

// /* works */
// export default async function($config) {
//   $config.addCollection("posts", collectionApi => {
//     return collectionApi.getFilteredByGlob("**/post*.md");
//   });
// }

// /* works */
// export default function($config) {
//   $config.addCollection("posts", async collectionApi => {
//     return collectionApi.getFilteredByGlob("**/post*.md");
//   });
// }
