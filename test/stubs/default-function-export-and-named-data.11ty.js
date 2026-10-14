export function data() {
  return { name: "Hello" }
};

// render
export default (data) => `<h1>${data.name} World</h1>`;