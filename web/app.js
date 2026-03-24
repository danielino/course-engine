/* ── State ───────────────────────────────────────────────────────────────── */
const state = {
  courses:       [],   // CourseInfo[] from /api/courses
  currentCourse: null, // slug string, e.g. "rust"
  lessons:       [],   // LessonSummary[]
  currentLesson: null, // full Lesson object
  currentExIdx:  0,
  progress:      {},
  editor:        null,
  hintIdx:       0,
};

/* ── Monaco bootstrap ────────────────────────────────────────────────────── */
require.config({
  paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs" },
});

require(["vs/editor/editor.main"], async () => {
  state.editor = monaco.editor.create(document.getElementById("editor-container"), {
    value:                "// select a lesson to begin",
    language:             "plaintext",
    theme:                "vs-dark",
    fontSize:             14,
    fontFamily:           '"JetBrains Mono", "Fira Code", monospace',
    fontLigatures:        true,
    minimap:              { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers:          "on",
    renderLineHighlight:  "line",
    padding:              { top: 12, bottom: 12 },
    automaticLayout:      true,
    suggestOnTriggerCharacters: true,
    quickSuggestions:     { other: true, comments: false, strings: false },
    wordBasedSuggestions: "off",
  });

  init();
});

/* ── Rust completion provider ────────────────────────────────────────────── */
let rustCompletionsRegistered = false;
function registerRustCompletionsOnce() {
  if (rustCompletionsRegistered) return;
  rustCompletionsRegistered = true;
  registerRustCompletions();
}

function registerRustCompletions() {
  const S = monaco.languages.CompletionItemKind;
  const SNIPPET = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  // ── Method completions (triggered by ".") ──────────────────────────────

  // Each entry: [label, insertText, detail, documentation]
  const METHODS = {
    // ── String / &str ──────────────────────────────────────────────────
    string: [
      ["len",          "len()",                         "fn len(&self) -> usize",                      "Returns the length in bytes."],
      ["is_empty",     "is_empty()",                    "fn is_empty(&self) -> bool",                  "Returns true if the string has no bytes."],
      ["clone",        "clone()",                       "fn clone(&self) -> String",                   "Creates a deep copy of the String."],
      ["to_string",    "to_string()",                   "fn to_string(&self) -> String",               "Converts to a String."],
      ["to_owned",     "to_owned()",                    "fn to_owned(&self) -> String",                "Creates an owned String from a &str."],
      ["as_str",       "as_str()",                      "fn as_str(&self) -> &str",                    "Extracts a &str slice from a String."],
      ["push_str",     "push_str(${1:s})",              "fn push_str(&mut self, string: &str)",        "Appends a string slice to a String."],
      ["push",         "push(${1:ch})",                 "fn push(&mut self, ch: char)",                "Appends a char to a String."],
      ["pop",          "pop()",                         "fn pop(&mut self) -> Option<char>",           "Removes and returns the last char."],
      ["trim",         "trim()",                        "fn trim(&self) -> &str",                      "Removes leading and trailing whitespace."],
      ["trim_start",   "trim_start()",                  "fn trim_start(&self) -> &str",                "Removes leading whitespace."],
      ["trim_end",     "trim_end()",                    "fn trim_end(&self) -> &str",                  "Removes trailing whitespace."],
      ["to_uppercase", "to_uppercase()",                "fn to_uppercase(&self) -> String",            "Returns the string in uppercase."],
      ["to_lowercase", "to_lowercase()",                "fn to_lowercase(&self) -> String",            "Returns the string in lowercase."],
      ["contains",     "contains(${1:pat})",            "fn contains(&self, pat: &str) -> bool",       "Returns true if the pattern is found."],
      ["starts_with",  "starts_with(${1:pat})",         "fn starts_with(&self, pat: &str) -> bool",   "Returns true if starts with the pattern."],
      ["ends_with",    "ends_with(${1:pat})",           "fn ends_with(&self, pat: &str) -> bool",      "Returns true if ends with the pattern."],
      ["replace",      "replace(${1:from}, ${2:to})",   "fn replace(&self, from: &str, to: &str) -> String", "Replaces all occurrences of a pattern."],
      ["split",        "split(${1:pat})",               "fn split(&self, pat: &str) -> Split",        "Splits the string by a pattern."],
      ["splitn",       "splitn(${1:n}, ${2:pat})",      "fn splitn(&self, n: usize, pat: &str) -> SplitN", "Splits into at most n substrings."],
      ["lines",        "lines()",                       "fn lines(&self) -> Lines",                    "Iterates over lines of the string."],
      ["chars",        "chars()",                       "fn chars(&self) -> Chars",                    "Iterates over Unicode scalar values."],
      ["bytes",        "bytes()",                       "fn bytes(&self) -> Bytes",                    "Iterates over bytes of the string."],
      ["find",         "find(${1:pat})",                "fn find(&self, pat: &str) -> Option<usize>",  "Returns the byte index of the first match."],
      ["parse",        "parse::<${1:T}>()",             "fn parse<F>(&self) -> Result<F, F::Err>",     "Parses the string into another type."],
      ["repeat",       "repeat(${1:n})",                "fn repeat(&self, n: usize) -> String",        "Repeats the string n times."],
      ["capacity",     "capacity()",                    "fn capacity(&self) -> usize",                 "Returns the String's current capacity."],
    ],

    // ── Vec<T> ────────────────────────────────────────────────────────
    vec: [
      ["len",       "len()",                      "fn len(&self) -> usize",                   "Returns the number of elements."],
      ["is_empty",  "is_empty()",                 "fn is_empty(&self) -> bool",               "Returns true if the Vec has no elements."],
      ["push",      "push(${1:value})",           "fn push(&mut self, value: T)",             "Appends an element to the back."],
      ["pop",       "pop()",                      "fn pop(&mut self) -> Option<T>",           "Removes and returns the last element."],
      ["insert",    "insert(${1:index}, ${2:element})", "fn insert(&mut self, index: usize, element: T)", "Inserts at a position."],
      ["remove",    "remove(${1:index})",         "fn remove(&mut self, index: usize) -> T",  "Removes and returns element at index."],
      ["contains",  "contains(&${1:value})",      "fn contains(&self, x: &T) -> bool",        "Returns true if the element is present."],
      ["iter",      "iter()",                     "fn iter(&self) -> Iter<T>",                "Returns an iterator over references."],
      ["iter_mut",  "iter_mut()",                 "fn iter_mut(&mut self) -> IterMut<T>",     "Returns an iterator over mutable references."],
      ["into_iter", "into_iter()",                "fn into_iter(self) -> IntoIter<T>",        "Consumes the Vec into an iterator."],
      ["sort",      "sort()",                     "fn sort(&mut self)",                       "Sorts in ascending order (requires Ord)."],
      ["sort_by",   "sort_by(|${1:a}, ${2:b}| ${1:a}.cmp(${2:b}))", "fn sort_by<F>(&mut self, compare: F)", "Sorts using a comparator function."],
      ["dedup",     "dedup()",                    "fn dedup(&mut self)",                      "Removes consecutive duplicate elements."],
      ["retain",    "retain(|${1:x}| ${2:*x > 0})", "fn retain<F>(&mut self, f: F)",        "Retains only elements satisfying the predicate."],
      ["extend",    "extend(${1:iter})",           "fn extend<I>(&mut self, iter: I)",         "Extends with elements from an iterator."],
      ["truncate",  "truncate(${1:len})",          "fn truncate(&mut self, len: usize)",       "Shortens the Vec to the specified length."],
      ["clear",     "clear()",                    "fn clear(&mut self)",                      "Removes all elements."],
      ["first",     "first()",                    "fn first(&self) -> Option<&T>",            "Returns a reference to the first element."],
      ["last",      "last()",                     "fn last(&self) -> Option<&T>",             "Returns a reference to the last element."],
      ["windows",   "windows(${1:size})",         "fn windows(&self, size: usize) -> Windows<T>", "Returns overlapping windows of size n."],
      ["chunks",    "chunks(${1:size})",          "fn chunks(&self, size: usize) -> Chunks<T>",   "Returns non-overlapping chunks."],
      ["join",      "join(${1:sep})",             "fn join(&self, sep: &str) -> String",      "Joins elements with a separator (for Vec<String>)."],
      ["capacity",  "capacity()",                 "fn capacity(&self) -> usize",              "Returns the Vec's current capacity."],
    ],

    // ── Option<T> ────────────────────────────────────────────────────
    option: [
      ["unwrap",         "unwrap()",                        "fn unwrap(self) -> T",                         "Returns the value, panics on None."],
      ["unwrap_or",      "unwrap_or(${1:default})",         "fn unwrap_or(self, default: T) -> T",          "Returns the value or a default."],
      ["unwrap_or_else", "unwrap_or_else(|| ${1:default})", "fn unwrap_or_else<F>(self, f: F) -> T",        "Returns the value or computes a default."],
      ["unwrap_or_default", "unwrap_or_default()",          "fn unwrap_or_default(self) -> T",              "Returns the value or T::default()."],
      ["expect",         "expect(${1:\"msg\"})",            "fn expect(self, msg: &str) -> T",              "Returns the value, panics with msg on None."],
      ["is_some",        "is_some()",                       "fn is_some(&self) -> bool",                    "Returns true if the option is Some."],
      ["is_none",        "is_none()",                       "fn is_none(&self) -> bool",                    "Returns true if the option is None."],
      ["map",            "map(|${1:x}| ${2:x})",           "fn map<U, F>(self, f: F) -> Option<U>",        "Maps Some(T) to Some(U) by applying f."],
      ["and_then",       "and_then(|${1:x}| ${2:Some(x)})", "fn and_then<U, F>(self, f: F) -> Option<U>",  "Chains an Option-returning function."],
      ["or",             "or(${1:other})",                  "fn or(self, optb: Option<T>) -> Option<T>",   "Returns self if Some, otherwise optb."],
      ["or_else",        "or_else(|| ${1:None})",           "fn or_else<F>(self, f: F) -> Option<T>",      "Returns self if Some, or calls f."],
      ["filter",         "filter(|${1:x}| ${2:true})",     "fn filter<P>(self, predicate: P) -> Option<T>", "Returns None if predicate returns false."],
      ["take",           "take()",                          "fn take(&mut self) -> Option<T>",              "Takes the value out, leaving None."],
      ["replace",        "replace(${1:value})",             "fn replace(&mut self, value: T) -> Option<T>", "Replaces the value, returning the old one."],
      ["as_ref",         "as_ref()",                        "fn as_ref(&self) -> Option<&T>",               "Converts Option<T> to Option<&T>."],
      ["cloned",         "cloned()",                        "fn cloned(self) -> Option<T>",                 "Maps Option<&T> to Option<T> by cloning."],
      ["flatten",        "flatten()",                       "fn flatten(self) -> Option<T>",                "Converts Option<Option<T>> to Option<T>."],
      ["zip",            "zip(${1:other})",                 "fn zip<U>(self, other: Option<U>) -> Option<(T, U)>", "Zips with another Option."],
    ],

    // ── Result<T, E> ─────────────────────────────────────────────────
    result: [
      ["unwrap",         "unwrap()",                        "fn unwrap(self) -> T",                          "Returns Ok value, panics on Err."],
      ["unwrap_or",      "unwrap_or(${1:default})",         "fn unwrap_or(self, default: T) -> T",           "Returns Ok value or a default."],
      ["unwrap_or_else", "unwrap_or_else(|${1:e}| ${2:todo!()})", "fn unwrap_or_else<F>(self, op: F) -> T", "Returns Ok value or computes a default."],
      ["unwrap_or_default", "unwrap_or_default()",          "fn unwrap_or_default(self) -> T",               "Returns Ok value or T::default()."],
      ["expect",         "expect(${1:\"msg\"})",            "fn expect(self, msg: &str) -> T",               "Returns Ok value, panics with msg on Err."],
      ["is_ok",          "is_ok()",                         "fn is_ok(&self) -> bool",                       "Returns true if the result is Ok."],
      ["is_err",         "is_err()",                        "fn is_err(&self) -> bool",                      "Returns true if the result is Err."],
      ["ok",             "ok()",                            "fn ok(self) -> Option<T>",                      "Converts Result to Option, discarding Err."],
      ["err",            "err()",                           "fn err(self) -> Option<E>",                     "Converts Result to Option<E>, discarding Ok."],
      ["map",            "map(|${1:v}| ${2:v})",            "fn map<U, F>(self, op: F) -> Result<U, E>",     "Maps Ok(T) to Ok(U)."],
      ["map_err",        "map_err(|${1:e}| ${2:e})",        "fn map_err<F, O>(self, op: O) -> Result<T, F>", "Maps Err(E) to Err(F)."],
      ["and_then",       "and_then(|${1:v}| ${2:Ok(v)})",  "fn and_then<U, F>(self, op: F) -> Result<U, E>","Chains a Result-returning function on Ok."],
      ["or_else",        "or_else(|${1:e}| ${2:Err(e)})",  "fn or_else<F, O>(self, op: O) -> Result<T, F>", "Calls op on Err, returns Ok unchanged."],
      ["as_ref",         "as_ref()",                        "fn as_ref(&self) -> Result<&T, &E>",            "Converts &Result<T,E> to Result<&T,&E>."],
      ["cloned",         "cloned()",                        "fn cloned(self) -> Result<T, E>",               "Maps Result<&T, E> to Result<T, E> by cloning."],
    ],

    // ── Iterator ─────────────────────────────────────────────────────
    iterator: [
      ["map",         "map(|${1:x}| ${2:x})",               "fn map<B, F>(self, f: F) -> Map<Self, F>",       "Transforms each element."],
      ["filter",      "filter(|${1:x}| ${2:true})",         "fn filter<P>(self, predicate: P) -> Filter",     "Keeps only elements matching the predicate."],
      ["filter_map",  "filter_map(|${1:x}| ${2:Some(x)})",  "fn filter_map<B, F>(self, f: F) -> FilterMap",   "Maps and keeps only Some values."],
      ["collect",     "collect::<${1:Vec<_>>>()",           "fn collect<B>(self) -> B",                       "Collects into a collection."],
      ["fold",        "fold(${1:0}, |${2:acc}, ${3:x}| ${2:acc} + ${3:x})", "fn fold<B, F>(self, init: B, f: F) -> B", "Reduces with an accumulator."],
      ["sum",         "sum::<${1:i32}>()",                  "fn sum<S>(self) -> S",                           "Sums all elements."],
      ["product",     "product::<${1:i32}>()",              "fn product<P>(self) -> P",                       "Multiplies all elements."],
      ["count",       "count()",                            "fn count(self) -> usize",                        "Counts the elements."],
      ["any",         "any(|${1:x}| ${2:true})",           "fn any<F>(&mut self, f: F) -> bool",             "Returns true if any element matches."],
      ["all",         "all(|${1:x}| ${2:true})",           "fn all<F>(&mut self, f: F) -> bool",             "Returns true if all elements match."],
      ["find",        "find(|${1:x}| ${2:true})",          "fn find<P>(&mut self, predicate: P) -> Option<Self::Item>", "Finds the first matching element."],
      ["position",    "position(|${1:x}| ${2:true})",      "fn position<P>(&mut self, predicate: P) -> Option<usize>", "Returns the index of the first match."],
      ["enumerate",   "enumerate()",                       "fn enumerate(self) -> Enumerate<Self>",           "Yields (index, element) pairs."],
      ["zip",         "zip(${1:other})",                   "fn zip<U>(self, other: U) -> Zip",               "Pairs elements with another iterator."],
      ["chain",       "chain(${1:other})",                 "fn chain<U>(self, other: U) -> Chain",           "Appends another iterator."],
      ["take",        "take(${1:n})",                      "fn take(self, n: usize) -> Take",                "Takes at most n elements."],
      ["skip",        "skip(${1:n})",                      "fn skip(self, n: usize) -> Skip",                "Skips the first n elements."],
      ["flat_map",    "flat_map(|${1:x}| ${2:vec![x]})",  "fn flat_map<U, F>(self, f: F) -> FlatMap",       "Maps then flattens one level."],
      ["flatten",     "flatten()",                         "fn flatten(self) -> Flatten",                    "Flattens one level of nesting."],
      ["cloned",      "cloned()",                          "fn cloned(self) -> Cloned",                      "Clones all &T elements to T."],
      ["copied",      "copied()",                          "fn copied(self) -> Copied",                      "Copies all &T elements (T: Copy)."],
      ["peekable",    "peekable()",                        "fn peekable(self) -> Peekable",                  "Creates an iterator that can peek ahead."],
      ["rev",         "rev()",                             "fn rev(self) -> Rev",                            "Reverses the iterator direction."],
      ["max",         "max()",                             "fn max(self) -> Option<Self::Item>",             "Returns the maximum element."],
      ["min",         "min()",                             "fn min(self) -> Option<Self::Item>",             "Returns the minimum element."],
      ["last",        "last()",                            "fn last(self) -> Option<Self::Item>",            "Returns the last element."],
      ["nth",         "nth(${1:n})",                       "fn nth(&mut self, n: usize) -> Option<Self::Item>", "Returns the nth element."],
      ["scan",        "scan(${1:init}, |${2:state}, ${3:x}| Some(${3:x}))", "fn scan<St, B, F>(self, initial_state: St, f: F) -> Scan", "Carries state, yields Some values."],
      ["partition",   "partition(|${1:x}| ${2:true})",    "fn partition<B, F>(self, f: F) -> (B, B)",       "Splits into two collections."],
      ["for_each",    "for_each(|${1:x}| { ${2:} })",     "fn for_each<F>(self, f: F)",                     "Calls a closure on each element."],
      ["inspect",     "inspect(|${1:x}| { ${2:} })",      "fn inspect<F>(self, f: F) -> Inspect",           "Peeks at each element (for debugging)."],
      ["take_while",  "take_while(|${1:x}| ${2:true})",   "fn take_while<P>(self, predicate: P) -> TakeWhile", "Takes elements while predicate holds."],
      ["skip_while",  "skip_while(|${1:x}| ${2:true})",   "fn skip_while<P>(self, predicate: P) -> SkipWhile", "Skips elements while predicate holds."],
      ["step_by",     "step_by(${1:step})",               "fn step_by(self, step: usize) -> StepBy",        "Steps by the given amount."],
      ["unzip",       "unzip()",                          "fn unzip<A, B, FromA, FromB>(self) -> (FromA, FromB)", "Splits an iterator of pairs into two collections."],
    ],

    // ── HashMap<K, V> ────────────────────────────────────────────────
    hashmap: [
      ["insert",       "insert(${1:key}, ${2:value})",    "fn insert(&mut self, k: K, v: V) -> Option<V>",  "Inserts a key-value pair."],
      ["get",          "get(&${1:key})",                  "fn get<Q>(&self, k: &Q) -> Option<&V>",          "Returns a reference to the value for the key."],
      ["get_mut",      "get_mut(&${1:key})",              "fn get_mut<Q>(&mut self, k: &Q) -> Option<&mut V>", "Returns a mutable reference to the value."],
      ["contains_key", "contains_key(&${1:key})",         "fn contains_key<Q>(&self, k: &Q) -> bool",       "Returns true if the map contains the key."],
      ["remove",       "remove(&${1:key})",               "fn remove<Q>(&mut self, k: &Q) -> Option<V>",    "Removes a key, returning its value."],
      ["entry",        "entry(${1:key})",                 "fn entry(&mut self, key: K) -> Entry<K, V>",     "Returns an Entry for in-place manipulation."],
      ["or_insert",    "or_insert(${1:default})",         "fn or_insert(self, default: V) -> &mut V",       "Inserts default if key is absent."],
      ["or_insert_with", "or_insert_with(|| ${1:default})", "fn or_insert_with<F>(self, default: F) -> &mut V", "Inserts a computed default if absent."],
      ["len",          "len()",                           "fn len(&self) -> usize",                          "Returns the number of elements."],
      ["is_empty",     "is_empty()",                      "fn is_empty(&self) -> bool",                      "Returns true if the map has no entries."],
      ["keys",         "keys()",                          "fn keys(&self) -> Keys<K, V>",                    "Iterates over keys."],
      ["values",       "values()",                        "fn values(&self) -> Values<K, V>",                "Iterates over values."],
      ["iter",         "iter()",                          "fn iter(&self) -> Iter<K, V>",                    "Iterates over (key, value) pairs."],
      ["iter_mut",     "iter_mut()",                      "fn iter_mut(&mut self) -> IterMut<K, V>",         "Iterates over mutable (key, value) pairs."],
      ["clear",        "clear()",                         "fn clear(&mut self)",                             "Removes all entries."],
      ["retain",       "retain(|${1:k}, ${2:v}| ${3:true})", "fn retain<F>(&mut self, f: F)",               "Retains only entries satisfying the predicate."],
    ],

    // ── General (available on most types) ───────────────────────────
    general: [
      ["clone",        "clone()",                         "fn clone(&self) -> Self",                        "Creates a copy of the value (requires Clone)."],
      ["to_string",    "to_string()",                     "fn to_string(&self) -> String",                  "Converts to String (requires Display)."],
      ["into",         "into()",                          "fn into(self) -> T",                             "Converts into another type (requires Into<T>)."],
      ["as_ref",       "as_ref()",                        "fn as_ref(&self) -> &T",                         "Converts to a reference (requires AsRef<T>)."],
      ["as_mut",       "as_mut()",                        "fn as_mut(&mut self) -> &mut T",                 "Converts to a mutable reference."],
      ["default",      "default()",                       "fn default() -> Self",                           "Returns the default value for the type."],
    ],
  };

  // ── Keyword / snippet completions ──────────────────────────────────────
  const SNIPPETS = [
    // Functions and closures
    { label: "fn",        insert: "fn ${1:name}(${2}) {\n\t${3}\n}",                    detail: "function definition" },
    { label: "fn →",      insert: "fn ${1:name}(${2}) -> ${3:ReturnType} {\n\t${4}\n}", detail: "function with return type" },
    { label: "pub fn",    insert: "pub fn ${1:name}(${2}) {\n\t${3}\n}",                detail: "public function" },
    { label: "async fn",  insert: "async fn ${1:name}(${2}) {\n\t${3}\n}",              detail: "async function" },
    { label: "closure",   insert: "|${1:x}| ${2:x}",                                   detail: "closure expression" },
    { label: "move ||",   insert: "move || {\n\t${1}\n}",                               detail: "move closure" },

    // Type definitions
    { label: "struct",    insert: "struct ${1:Name} {\n\t${2:field}: ${3:Type},\n}",    detail: "struct definition" },
    { label: "enum",      insert: "enum ${1:Name} {\n\t${2:Variant},\n}",               detail: "enum definition" },
    { label: "impl",      insert: "impl ${1:Type} {\n\t${2}\n}",                        detail: "impl block" },
    { label: "impl for",  insert: "impl ${1:Trait} for ${2:Type} {\n\t${3}\n}",         detail: "trait implementation" },
    { label: "trait",     insert: "trait ${1:Name} {\n\t${2}\n}",                       detail: "trait definition" },

    // Control flow
    { label: "if",        insert: "if ${1:condition} {\n\t${2}\n}",                     detail: "if expression" },
    { label: "if let",    insert: "if let ${1:Some(x)} = ${2:expr} {\n\t${3}\n}",       detail: "if let pattern" },
    { label: "while let", insert: "while let ${1:Some(x)} = ${2:iter.next()} {\n\t${3}\n}", detail: "while let loop" },
    { label: "match",     insert: "match ${1:expr} {\n\t${2:_} => ${3:{}},\n}",         detail: "match expression" },
    { label: "loop",      insert: "loop {\n\t${1}\n}",                                  detail: "infinite loop" },
    { label: "while",     insert: "while ${1:condition} {\n\t${2}\n}",                  detail: "while loop" },
    { label: "for in",    insert: "for ${1:item} in ${2:iter} {\n\t${3}\n}",            detail: "for loop" },

    // let bindings
    { label: "let",       insert: "let ${1:name} = ${2:value};",                        detail: "immutable binding" },
    { label: "let mut",   insert: "let mut ${1:name} = ${2:value};",                    detail: "mutable binding" },

    // Common macros
    { label: "println!",  insert: "println!(\"${1}\", ${2});",                          detail: "macro: print with newline" },
    { label: "print!",    insert: "print!(\"${1}\", ${2});",                            detail: "macro: print without newline" },
    { label: "eprintln!", insert: "eprintln!(\"${1}\", ${2});",                         detail: "macro: print to stderr" },
    { label: "format!",   insert: "format!(\"${1}\", ${2})",                            detail: "macro: format to String" },
    { label: "vec!",      insert: "vec![${1}]",                                         detail: "macro: Vec literal" },
    { label: "assert!",   insert: "assert!(${1:condition});",                           detail: "macro: assert condition" },
    { label: "assert_eq!",insert: "assert_eq!(${1:left}, ${2:right});",                 detail: "macro: assert equality" },
    { label: "panic!",    insert: "panic!(\"${1:message}\");",                          detail: "macro: panic with message" },
    { label: "todo!",     insert: "todo!()",                                            detail: "macro: unimplemented placeholder" },
    { label: "dbg!",      insert: "dbg!(${1:expr})",                                   detail: "macro: debug print with value" },

    // Common type constructors
    { label: "Some",      insert: "Some(${1:value})",                                   detail: "Option::Some" },
    { label: "None",      insert: "None",                                               detail: "Option::None" },
    { label: "Ok",        insert: "Ok(${1:value})",                                     detail: "Result::Ok" },
    { label: "Err",       insert: "Err(${1:error})",                                    detail: "Result::Err" },
    { label: "Box::new",  insert: "Box::new(${1:value})",                               detail: "heap-allocate a value" },
    { label: "Rc::new",   insert: "Rc::new(${1:value})",                                detail: "reference-counted pointer" },
    { label: "Arc::new",  insert: "Arc::new(${1:value})",                               detail: "atomically reference-counted pointer" },
    { label: "RefCell::new", insert: "RefCell::new(${1:value})",                        detail: "interior mutability cell" },
    { label: "HashMap::new", insert: "HashMap::new()",                                  detail: "new empty HashMap" },
    { label: "Vec::new",  insert: "Vec::new()",                                         detail: "new empty Vec" },
    { label: "String::from", insert: "String::from(${1:\"value\"})",                   detail: "create String from &str" },
    { label: "String::new",  insert: "String::new()",                                   detail: "new empty String" },

    // Derive attributes
    { label: "#[derive]", insert: "#[derive(${1:Debug})]",                              detail: "derive attribute" },
    { label: "derive Debug", insert: "#[derive(Debug)]",                                detail: "derive Debug" },
    { label: "derive Clone", insert: "#[derive(Debug, Clone)]",                         detail: "derive Debug + Clone" },
  ];

  monaco.languages.registerCompletionItemProvider("rust", {
    triggerCharacters: ["."],

    provideCompletionItems(model, position) {
      const lineText = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn:     1,
        endLineNumber:   position.lineNumber,
        endColumn:       position.column,
      });

      const word    = model.getWordUntilPosition(position);
      const wordRange = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      };

      // ── Dot-triggered: method completions ──────────────────────────
      const dotMatch = lineText.match(/\.(\w*)$/);
      if (dotMatch) {
        const typed    = dotMatch[1];
        const dotCol   = position.column - dotMatch[0].length;
        const afterDot = {
          startLineNumber: position.lineNumber,
          endLineNumber:   position.lineNumber,
          startColumn:     dotCol + 1,
          endColumn:       position.column,
        };

        const allMethods = [
          ...METHODS.string,
          ...METHODS.vec,
          ...METHODS.option,
          ...METHODS.result,
          ...METHODS.iterator,
          ...METHODS.hashmap,
          ...METHODS.general,
        ];

        const seen   = new Set();
        const prefix = typed.toLowerCase();
        const unique = allMethods.filter(([label]) => {
          if (seen.has(label)) return false;
          seen.add(label);
          return label.startsWith(prefix);
        });

        const suggestions = unique
          .map(([label, insert, detail, doc]) => ({
            label,
            filterText:       label,
            kind:             S.Method,
            detail,
            documentation:    { value: doc },
            insertText:       insert,
            insertTextRules:  SNIPPET,
            range:            afterDot,
            sortText:         label,
          }));

        return { suggestions, incomplete: false };
      }

      // ── Keyword / snippet completions ──────────────────────────────
      const suggestions = SNIPPETS.map(({ label, insert, detail }) => ({
        label,
        kind:            label.endsWith("!") ? S.Function : S.Keyword,
        detail,
        insertText:      insert,
        insertTextRules: SNIPPET,
        range:           wordRange,
        sortText:        "z" + label,
      }));

      return { suggestions };
    },
  });
}

/* ── Python completion provider ──────────────────────────────────────────── */
let pythonCompletionsRegistered = false;
function registerPythonCompletionsOnce() {
  if (pythonCompletionsRegistered) return;
  pythonCompletionsRegistered = true;
  registerPythonCompletions();
}

function registerPythonCompletions() {
  const S = monaco.languages.CompletionItemKind;
  const SNIPPET = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  const METHODS = {
    str: [
      ["upper",       "upper()",                       "str.upper() -> str",              "Return a copy in uppercase."],
      ["lower",       "lower()",                       "str.lower() -> str",              "Return a copy in lowercase."],
      ["strip",       "strip()",                       "str.strip() -> str",              "Remove leading/trailing whitespace."],
      ["lstrip",      "lstrip()",                      "str.lstrip() -> str",             "Remove leading whitespace."],
      ["rstrip",      "rstrip()",                      "str.rstrip() -> str",             "Remove trailing whitespace."],
      ["split",       "split(${1:sep})",               "str.split(sep=None) -> list",     "Split by separator, returns list."],
      ["splitlines",  "splitlines()",                  "str.splitlines() -> list",        "Split on line boundaries."],
      ["join",        "join(${1:iterable})",           "str.join(iterable) -> str",       "Join iterable with this string as separator."],
      ["replace",     "replace(${1:old}, ${2:new})",   "str.replace(old, new) -> str",    "Replace all occurrences of old with new."],
      ["find",        "find(${1:sub})",                "str.find(sub) -> int",            "Return index of first occurrence, -1 if not found."],
      ["index",       "index(${1:sub})",               "str.index(sub) -> int",           "Like find() but raises ValueError if not found."],
      ["count",       "count(${1:sub})",               "str.count(sub) -> int",           "Return number of non-overlapping occurrences."],
      ["startswith",  "startswith(${1:prefix})",       "str.startswith(prefix) -> bool",  "Return True if string starts with prefix."],
      ["endswith",    "endswith(${1:suffix})",         "str.endswith(suffix) -> bool",    "Return True if string ends with suffix."],
      ["format",      "format(${1})",                  "str.format(*args, **kwargs) -> str", "Perform string formatting."],
      ["encode",      "encode(${1:'utf-8'})",          "str.encode(encoding) -> bytes",   "Encode to bytes."],
      ["isdigit",     "isdigit()",                     "str.isdigit() -> bool",           "Return True if all chars are digits."],
      ["isalpha",     "isalpha()",                     "str.isalpha() -> bool",           "Return True if all chars are alphabetic."],
      ["isalnum",     "isalnum()",                     "str.isalnum() -> bool",           "Return True if all chars are alphanumeric."],
      ["zfill",       "zfill(${1:width})",             "str.zfill(width) -> str",         "Pad with leading zeros to given width."],
      ["center",      "center(${1:width})",            "str.center(width) -> str",        "Center in a field of given width."],
      ["ljust",       "ljust(${1:width})",             "str.ljust(width) -> str",         "Left-justify in a field of given width."],
      ["rjust",       "rjust(${1:width})",             "str.rjust(width) -> str",         "Right-justify in a field of given width."],
      ["title",       "title()",                       "str.title() -> str",              "Return titlecased version."],
      ["capitalize",  "capitalize()",                  "str.capitalize() -> str",         "Return copy with first char uppercased."],
    ],
    list: [
      ["append",      "append(${1:item})",             "list.append(item)",               "Append item to end of list."],
      ["extend",      "extend(${1:iterable})",         "list.extend(iterable)",           "Extend list by appending all items from iterable."],
      ["insert",      "insert(${1:i}, ${2:item})",     "list.insert(i, item)",            "Insert item at position i."],
      ["remove",      "remove(${1:item})",             "list.remove(item)",               "Remove first occurrence of item."],
      ["pop",         "pop(${1:-1})",                  "list.pop(index=-1) -> item",      "Remove and return item at index."],
      ["clear",       "clear()",                       "list.clear()",                    "Remove all items."],
      ["index",       "index(${1:item})",              "list.index(item) -> int",         "Return index of first occurrence."],
      ["count",       "count(${1:item})",              "list.count(item) -> int",         "Return number of occurrences of item."],
      ["sort",        "sort(${1:key=None, reverse=False})", "list.sort(key=None, reverse=False)", "Sort list in place."],
      ["reverse",     "reverse()",                     "list.reverse()",                  "Reverse list in place."],
      ["copy",        "copy()",                        "list.copy() -> list",             "Return a shallow copy."],
    ],
    dict: [
      ["get",         "get(${1:key}, ${2:None})",      "dict.get(key, default=None)",     "Return value for key, or default if not found."],
      ["keys",        "keys()",                        "dict.keys() -> KeysView",         "Return a view of the dictionary's keys."],
      ["values",      "values()",                      "dict.values() -> ValuesView",     "Return a view of the dictionary's values."],
      ["items",       "items()",                       "dict.items() -> ItemsView",       "Return a view of (key, value) pairs."],
      ["update",      "update(${1:other})",            "dict.update(other)",              "Update the dictionary with another dict or iterable of pairs."],
      ["pop",         "pop(${1:key})",                 "dict.pop(key) -> value",          "Remove key and return its value."],
      ["setdefault",  "setdefault(${1:key}, ${2:None})", "dict.setdefault(key, default=None)", "Return value for key; insert key with default if absent."],
      ["clear",       "clear()",                       "dict.clear()",                    "Remove all items."],
      ["copy",        "copy()",                        "dict.copy() -> dict",             "Return a shallow copy."],
    ],
    set: [
      ["add",             "add(${1:elem})",                "set.add(elem)",                     "Add element to the set."],
      ["remove",          "remove(${1:elem})",             "set.remove(elem)",                  "Remove element; raises KeyError if not present."],
      ["discard",         "discard(${1:elem})",            "set.discard(elem)",                 "Remove element if present (no error if absent)."],
      ["pop",             "pop()",                         "set.pop() -> elem",                 "Remove and return an arbitrary element."],
      ["clear",           "clear()",                       "set.clear()",                       "Remove all elements."],
      ["union",           "union(${1:other})",             "set.union(*others) -> set",         "Return a new set with elements from all sets."],
      ["intersection",    "intersection(${1:other})",      "set.intersection(*others) -> set",  "Return a new set with elements common to all sets."],
      ["difference",      "difference(${1:other})",        "set.difference(*others) -> set",    "Return a new set with elements not in others."],
      ["issubset",        "issubset(${1:other})",          "set.issubset(other) -> bool",       "Return True if set is a subset of other."],
      ["issuperset",      "issuperset(${1:other})",        "set.issuperset(other) -> bool",     "Return True if set is a superset of other."],
      ["isdisjoint",      "isdisjoint(${1:other})",        "set.isdisjoint(other) -> bool",     "Return True if set has no elements in common with other."],
    ],
  };

  const SNIPPETS = [
    { label: "def",          insert: "def ${1:name}(${2}):\n\t${3:pass}",                   detail: "function definition" },
    { label: "def →",        insert: "def ${1:name}(${2}) -> ${3:None}:\n\t${4:pass}",       detail: "function with return type hint" },
    { label: "class",        insert: "class ${1:Name}:\n\tdef __init__(self${2}):\n\t\t${3:pass}", detail: "class definition" },
    { label: "if",           insert: "if ${1:condition}:\n\t${2:pass}",                      detail: "if statement" },
    { label: "if/else",      insert: "if ${1:condition}:\n\t${2:pass}\nelse:\n\t${3:pass}",  detail: "if/else statement" },
    { label: "elif",         insert: "elif ${1:condition}:\n\t${2:pass}",                    detail: "elif clause" },
    { label: "for in",       insert: "for ${1:item} in ${2:iterable}:\n\t${3:pass}",         detail: "for loop" },
    { label: "for range",    insert: "for ${1:i} in range(${2:n}):\n\t${3:pass}",            detail: "for loop with range" },
    { label: "while",        insert: "while ${1:condition}:\n\t${2:pass}",                   detail: "while loop" },
    { label: "with",         insert: "with ${1:expr} as ${2:f}:\n\t${3:pass}",               detail: "context manager" },
    { label: "try",          insert: "try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}", detail: "try/except block" },
    { label: "try/finally",  insert: "try:\n\t${1:pass}\nfinally:\n\t${2:pass}",             detail: "try/finally block" },
    { label: "lambda",       insert: "lambda ${1:x}: ${2:x}",                               detail: "lambda expression" },
    { label: "import",       insert: "import ${1:module}",                                   detail: "import statement" },
    { label: "from import",  insert: "from ${1:module} import ${2:name}",                    detail: "from … import statement" },
    { label: "print",        insert: "print(${1})",                                          detail: "print to stdout" },
    { label: "print f",      insert: "print(f\"${1}\")",                                    detail: "print f-string" },
    { label: "len",          insert: "len(${1:obj})",                                        detail: "builtin: length of object" },
    { label: "range",        insert: "range(${1:stop})",                                     detail: "builtin: range sequence" },
    { label: "enumerate",    insert: "enumerate(${1:iterable})",                             detail: "builtin: (index, value) pairs" },
    { label: "zip",          insert: "zip(${1:a}, ${2:b})",                                  detail: "builtin: zip iterables" },
    { label: "map",          insert: "map(${1:fn}, ${2:iterable})",                          detail: "builtin: apply function to each item" },
    { label: "filter",       insert: "filter(${1:fn}, ${2:iterable})",                       detail: "builtin: filter items by predicate" },
    { label: "sorted",       insert: "sorted(${1:iterable})",                                detail: "builtin: return sorted list" },
    { label: "isinstance",   insert: "isinstance(${1:obj}, ${2:type})",                      detail: "builtin: check type" },
    { label: "list comp",    insert: "[${1:expr} for ${2:x} in ${3:iterable}]",              detail: "list comprehension" },
    { label: "dict comp",    insert: "{${1:k}: ${2:v} for ${3:k}, ${4:v} in ${5:items}}",   detail: "dict comprehension" },
    { label: "set comp",     insert: "{${1:expr} for ${2:x} in ${3:iterable}}",              detail: "set comprehension" },
    { label: "gen expr",     insert: "(${1:expr} for ${2:x} in ${3:iterable})",              detail: "generator expression" },
    { label: "@property",    insert: "@property\ndef ${1:name}(self):\n\treturn self._${1:name}", detail: "property decorator" },
    { label: "@staticmethod",insert: "@staticmethod\ndef ${1:name}(${2}):\n\t${3:pass}",     detail: "static method decorator" },
    { label: "@classmethod", insert: "@classmethod\ndef ${1:name}(cls${2}):\n\t${3:pass}",   detail: "class method decorator" },
    { label: "if __main__",  insert: "if __name__ == \"__main__\":\n\t${1:main()}",           detail: "main guard" },
  ];

  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: ["."],

    provideCompletionItems(model, position) {
      const lineText = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn:     1,
        endLineNumber:   position.lineNumber,
        endColumn:       position.column,
      });

      const word      = model.getWordUntilPosition(position);
      const wordRange = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      };

      const dotMatch = lineText.match(/\.(\w*)$/);
      if (dotMatch) {
        const typed    = dotMatch[1];
        const dotCol   = position.column - dotMatch[0].length;
        const afterDot = {
          startLineNumber: position.lineNumber,
          endLineNumber:   position.lineNumber,
          startColumn:     dotCol + 1,
          endColumn:       position.column,
        };

        const allMethods = [
          ...METHODS.str,
          ...METHODS.list,
          ...METHODS.dict,
          ...METHODS.set,
        ];

        const seen   = new Set();
        const prefix = typed.toLowerCase();
        const unique = allMethods.filter(([label]) => {
          if (seen.has(label)) return false;
          seen.add(label);
          return label.startsWith(prefix);
        });

        return {
          suggestions: unique.map(([label, insert, detail, doc]) => ({
            label,
            filterText:      label,
            kind:            S.Method,
            detail,
            documentation:   { value: doc },
            insertText:      insert,
            insertTextRules: SNIPPET,
            range:           afterDot,
            sortText:        label,
          })),
          incomplete: false,
        };
      }

      return {
        suggestions: SNIPPETS.map(({ label, insert, detail }) => ({
          label,
          kind:            S.Keyword,
          detail,
          insertText:      insert,
          insertTextRules: SNIPPET,
          range:           wordRange,
          sortText:        "z" + label,
        })),
      };
    },
  });
}

/* ── JavaScript completion provider ──────────────────────────────────────── */
let javascriptCompletionsRegistered = false;
function registerJavaScriptCompletionsOnce() {
  if (javascriptCompletionsRegistered) return;
  javascriptCompletionsRegistered = true;
  registerJavaScriptCompletions();
}

function registerJavaScriptCompletions() {
  const S = monaco.languages.CompletionItemKind;
  const SNIPPET = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  const METHODS = {
    array: [
      ["push",        "push(${1:item})",                        "Array.push(item) -> length",        "Append one or more elements to the end."],
      ["pop",         "pop()",                                  "Array.pop() -> item",               "Remove and return the last element."],
      ["shift",       "shift()",                                "Array.shift() -> item",             "Remove and return the first element."],
      ["unshift",     "unshift(${1:item})",                     "Array.unshift(item) -> length",     "Insert element(s) at the beginning."],
      ["map",         "map((${1:item}) => ${2:item})",          "Array.map(fn) -> Array",            "Transform each element with a function."],
      ["filter",      "filter((${1:item}) => ${2:true})",       "Array.filter(fn) -> Array",         "Keep only elements matching the predicate."],
      ["reduce",      "reduce((${1:acc}, ${2:cur}) => ${3:acc}, ${4:0})", "Array.reduce(fn, init) -> value", "Fold elements into a single value."],
      ["forEach",     "forEach((${1:item}) => { ${2} })",       "Array.forEach(fn) -> void",         "Execute a function for each element."],
      ["find",        "find((${1:item}) => ${2:true})",         "Array.find(fn) -> item|undefined",  "Return first element matching predicate."],
      ["findIndex",   "findIndex((${1:item}) => ${2:true})",    "Array.findIndex(fn) -> int",        "Return index of first match, or -1."],
      ["some",        "some((${1:item}) => ${2:true})",         "Array.some(fn) -> bool",            "Return true if any element matches."],
      ["every",       "every((${1:item}) => ${2:true})",        "Array.every(fn) -> bool",           "Return true if all elements match."],
      ["includes",    "includes(${1:item})",                    "Array.includes(item) -> bool",      "Return true if item is in array."],
      ["indexOf",     "indexOf(${1:item})",                     "Array.indexOf(item) -> int",        "Return index of first occurrence, or -1."],
      ["join",        "join(${1:''})",                          "Array.join(sep) -> string",         "Join all elements into a string."],
      ["slice",       "slice(${1:start}, ${2:end})",            "Array.slice(start, end) -> Array",  "Return a shallow copy of a portion."],
      ["splice",      "splice(${1:start}, ${2:count})",         "Array.splice(start, count)",        "Change array by removing/adding elements."],
      ["sort",        "sort((${1:a}, ${2:b}) => ${1:a} - ${2:b})", "Array.sort(fn) -> Array",       "Sort elements in place."],
      ["reverse",     "reverse()",                              "Array.reverse() -> Array",          "Reverse elements in place."],
      ["flat",        "flat(${1:1})",                           "Array.flat(depth) -> Array",        "Flatten nested arrays."],
      ["flatMap",     "flatMap((${1:item}) => ${2:item})",      "Array.flatMap(fn) -> Array",        "Map then flatten one level."],
      ["concat",      "concat(${1:other})",                     "Array.concat(...args) -> Array",    "Merge arrays without mutation."],
      ["fill",        "fill(${1:value})",                       "Array.fill(value) -> Array",        "Fill all elements with a value."],
    ],
    string: [
      ["split",       "split(${1:''})",                         "String.split(sep) -> Array",        "Split string into an array."],
      ["trim",        "trim()",                                  "String.trim() -> string",           "Remove leading/trailing whitespace."],
      ["trimStart",   "trimStart()",                            "String.trimStart() -> string",      "Remove leading whitespace."],
      ["trimEnd",     "trimEnd()",                              "String.trimEnd() -> string",        "Remove trailing whitespace."],
      ["toLowerCase", "toLowerCase()",                          "String.toLowerCase() -> string",    "Convert to lowercase."],
      ["toUpperCase", "toUpperCase()",                          "String.toUpperCase() -> string",    "Convert to uppercase."],
      ["includes",    "includes(${1:substr})",                  "String.includes(str) -> bool",      "Return true if string contains substr."],
      ["startsWith",  "startsWith(${1:prefix})",                "String.startsWith(str) -> bool",    "Return true if starts with prefix."],
      ["endsWith",    "endsWith(${1:suffix})",                  "String.endsWith(str) -> bool",      "Return true if ends with suffix."],
      ["indexOf",     "indexOf(${1:substr})",                   "String.indexOf(str) -> int",        "Return index of first occurrence, or -1."],
      ["slice",       "slice(${1:start}, ${2:end})",            "String.slice(start, end) -> string","Extract a section of a string."],
      ["substring",   "substring(${1:start}, ${2:end})",        "String.substring(start, end) -> string", "Return part of the string between indices."],
      ["replace",     "replace(${1:search}, ${2:replacement})", "String.replace(str, str) -> string","Replace first occurrence."],
      ["replaceAll",  "replaceAll(${1:search}, ${2:replacement})", "String.replaceAll(str, str) -> string", "Replace all occurrences."],
      ["padStart",    "padStart(${1:length}, ${2:' '})",        "String.padStart(length, char) -> string", "Pad start to target length."],
      ["padEnd",      "padEnd(${1:length}, ${2:' '})",          "String.padEnd(length, char) -> string",   "Pad end to target length."],
      ["repeat",      "repeat(${1:n})",                         "String.repeat(n) -> string",        "Repeat string n times."],
      ["match",       "match(${1:/pattern/})",                  "String.match(regex) -> Array|null", "Match against a regular expression."],
      ["charAt",      "charAt(${1:index})",                     "String.charAt(index) -> string",    "Return character at given index."],
      ["charCodeAt",  "charCodeAt(${1:index})",                 "String.charCodeAt(index) -> int",   "Return UTF-16 code unit at index."],
    ],
    object: [
      ["hasOwnProperty", "hasOwnProperty(${1:key})",           "Object.hasOwnProperty(key) -> bool","Check if key is own property."],
    ],
    promise: [
      ["then",        "then((${1:result}) => { ${2} })",        "Promise.then(fn) -> Promise",       "Handle fulfilled value."],
      ["catch",       "catch((${1:err}) => { ${2} })",          "Promise.catch(fn) -> Promise",      "Handle rejected reason."],
      ["finally",     "finally(() => { ${1} })",                "Promise.finally(fn) -> Promise",    "Run regardless of outcome."],
    ],
    map: [
      ["set",         "set(${1:key}, ${2:value})",              "Map.set(key, value) -> Map",        "Set key to value."],
      ["get",         "get(${1:key})",                          "Map.get(key) -> value",             "Return value for key."],
      ["has",         "has(${1:key})",                          "Map.has(key) -> bool",              "Return true if key exists."],
      ["delete",      "delete(${1:key})",                       "Map.delete(key) -> bool",           "Remove key from map."],
      ["keys",        "keys()",                                  "Map.keys() -> Iterator",            "Iterate over keys."],
      ["values",      "values()",                               "Map.values() -> Iterator",          "Iterate over values."],
      ["entries",     "entries()",                              "Map.entries() -> Iterator",         "Iterate over [key, value] pairs."],
      ["forEach",     "forEach((${1:val}, ${2:key}) => { ${3} })", "Map.forEach(fn)",              "Execute function for each entry."],
      ["clear",       "clear()",                                "Map.clear()",                       "Remove all entries."],
    ],
    set: [
      ["add",         "add(${1:value})",                        "Set.add(value) -> Set",             "Add value to the set."],
      ["has",         "has(${1:value})",                        "Set.has(value) -> bool",            "Return true if value is in set."],
      ["delete",      "delete(${1:value})",                     "Set.delete(value) -> bool",         "Remove value from set."],
      ["forEach",     "forEach((${1:val}) => { ${2} })",        "Set.forEach(fn)",                   "Execute function for each value."],
      ["clear",       "clear()",                                "Set.clear()",                       "Remove all values."],
    ],
  };

  const SNIPPETS = [
    { label: "const",         insert: "const ${1:name} = ${2:value};",                           detail: "constant declaration" },
    { label: "let",           insert: "let ${1:name} = ${2:value};",                             detail: "variable declaration" },
    { label: "function",      insert: "function ${1:name}(${2}) {\n\t${3}\n}",                   detail: "function declaration" },
    { label: "arrow fn",      insert: "const ${1:name} = (${2}) => {\n\t${3}\n};",               detail: "arrow function" },
    { label: "arrow expr",    insert: "(${1:x}) => ${2:x}",                                      detail: "arrow function expression" },
    { label: "async fn",      insert: "async function ${1:name}(${2}) {\n\t${3}\n}",             detail: "async function declaration" },
    { label: "async arrow",   insert: "const ${1:name} = async (${2}) => {\n\t${3}\n};",         detail: "async arrow function" },
    { label: "class",         insert: "class ${1:Name} {\n\tconstructor(${2}) {\n\t\t${3}\n\t}\n}", detail: "class declaration" },
    { label: "class extends", insert: "class ${1:Name} extends ${2:Base} {\n\tconstructor(${3}) {\n\t\tsuper(${4});\n\t\t${5}\n\t}\n}", detail: "class with inheritance" },
    { label: "if",            insert: "if (${1:condition}) {\n\t${2}\n}",                        detail: "if statement" },
    { label: "if/else",       insert: "if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}",      detail: "if/else statement" },
    { label: "ternary",       insert: "${1:condition} ? ${2:then} : ${3:else}",                  detail: "ternary expression" },
    { label: "for",           insert: "for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}", detail: "for loop" },
    { label: "for of",        insert: "for (const ${1:item} of ${2:iterable}) {\n\t${3}\n}",     detail: "for…of loop" },
    { label: "for in",        insert: "for (const ${1:key} in ${2:object}) {\n\t${3}\n}",        detail: "for…in loop" },
    { label: "while",         insert: "while (${1:condition}) {\n\t${2}\n}",                     detail: "while loop" },
    { label: "switch",        insert: "switch (${1:expr}) {\n\tcase ${2:value}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\t${4}\n}", detail: "switch statement" },
    { label: "try/catch",     insert: "try {\n\t${1}\n} catch (${2:err}) {\n\t${3}\n}",          detail: "try/catch block" },
    { label: "try/finally",   insert: "try {\n\t${1}\n} finally {\n\t${2}\n}",                   detail: "try/finally block" },
    { label: "await",         insert: "await ${1:promise}",                                      detail: "await expression" },
    { label: "Promise.all",   insert: "await Promise.all([${1}])",                               detail: "await multiple promises" },
    { label: "new Promise",   insert: "new Promise((${1:resolve}, ${2:reject}) => {\n\t${3}\n})", detail: "Promise constructor" },
    { label: "require",       insert: "const ${1:name} = require('${2:module}');",               detail: "CommonJS require" },
    { label: "console.log",   insert: "console.log(${1});",                                      detail: "log to console" },
    { label: "console.error", insert: "console.error(${1});",                                    detail: "log error to console" },
    { label: "JSON.parse",    insert: "JSON.parse(${1:str})",                                    detail: "parse JSON string" },
    { label: "JSON.stringify",insert: "JSON.stringify(${1:obj}, null, 2)",                        detail: "stringify to JSON" },
    { label: "Object.keys",   insert: "Object.keys(${1:obj})",                                   detail: "get object keys" },
    { label: "Object.values", insert: "Object.values(${1:obj})",                                 detail: "get object values" },
    { label: "Object.entries",insert: "Object.entries(${1:obj})",                                detail: "get [key, value] pairs" },
    { label: "Object.assign", insert: "Object.assign(${1:target}, ${2:source})",                 detail: "shallow merge objects" },
    { label: "spread obj",    insert: "{ ...${1:obj}, ${2:key}: ${3:value} }",                   detail: "spread operator (object)" },
    { label: "spread arr",    insert: "[...${1:arr}, ${2:item}]",                                detail: "spread operator (array)" },
    { label: "destructure",   insert: "const { ${1:key} } = ${2:obj};",                          detail: "object destructuring" },
    { label: "Array.from",    insert: "Array.from(${1:iterable})",                               detail: "create array from iterable" },
    { label: "Array.isArray", insert: "Array.isArray(${1:val})",                                 detail: "check if value is an array" },
    { label: "typeof",        insert: "typeof ${1:val}",                                         detail: "type of value" },
    { label: "instanceof",    insert: "${1:obj} instanceof ${2:Class}",                           detail: "prototype chain check" },
  ];

  monaco.languages.registerCompletionItemProvider("javascript", {
    triggerCharacters: ["."],

    provideCompletionItems(model, position) {
      const lineText = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn:     1,
        endLineNumber:   position.lineNumber,
        endColumn:       position.column,
      });

      const word      = model.getWordUntilPosition(position);
      const wordRange = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      };

      const dotMatch = lineText.match(/\.(\w*)$/);
      if (dotMatch) {
        const typed    = dotMatch[1];
        const dotCol   = position.column - dotMatch[0].length;
        const afterDot = {
          startLineNumber: position.lineNumber,
          endLineNumber:   position.lineNumber,
          startColumn:     dotCol + 1,
          endColumn:       position.column,
        };

        const allMethods = [
          ...METHODS.array,
          ...METHODS.string,
          ...METHODS.object,
          ...METHODS.promise,
          ...METHODS.map,
          ...METHODS.set,
        ];

        const seen   = new Set();
        const prefix = typed.toLowerCase();
        const unique = allMethods.filter(([label]) => {
          if (seen.has(label)) return false;
          seen.add(label);
          return label.toLowerCase().startsWith(prefix);
        });

        return {
          suggestions: unique.map(([label, insert, detail, doc]) => ({
            label,
            filterText:      label,
            kind:            S.Method,
            detail,
            documentation:   { value: doc },
            insertText:      insert,
            insertTextRules: SNIPPET,
            range:           afterDot,
            sortText:        label,
          })),
          incomplete: false,
        };
      }

      return {
        suggestions: SNIPPETS.map(({ label, insert, detail }) => ({
          label,
          kind:            label.startsWith("console") ? S.Function : S.Keyword,
          detail,
          insertText:      insert,
          insertTextRules: SNIPPET,
          range:           wordRange,
          sortText:        "z" + label,
        })),
      };
    },
  });
}

/* ── C completion provider ───────────────────────────────────────────────── */
let cCompletionsRegistered = false;
function registerCCompletionsOnce() {
  if (cCompletionsRegistered) return;
  cCompletionsRegistered = true;
  registerCCompletions();
}

function registerCCompletions() {
  const S = monaco.languages.CompletionItemKind;
  const SNIPPET = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  const SNIPPETS = [
    // Preprocessor
    { label: "#include <stdio.h>",   insert: "#include <stdio.h>",                           detail: "standard I/O header" },
    { label: "#include <stdlib.h>",  insert: "#include <stdlib.h>",                          detail: "standard library header (malloc, free, exit)" },
    { label: "#include <string.h>",  insert: "#include <string.h>",                          detail: "string functions header" },
    { label: "#include <math.h>",    insert: "#include <math.h>",                            detail: "math functions header" },
    { label: "#include <stdbool.h>", insert: "#include <stdbool.h>",                         detail: "bool type header" },
    { label: "#include <stdint.h>",  insert: "#include <stdint.h>",                          detail: "fixed-width integer types" },
    { label: "#include <limits.h>",  insert: "#include <limits.h>",                          detail: "integer limits (INT_MAX, etc.)" },
    { label: "#define",              insert: "#define ${1:NAME} ${2:value}",                  detail: "preprocessor macro definition" },

    // Entry point
    { label: "main",           insert: "int main(void) {\n\t${1}\n\treturn 0;\n}",           detail: "main function (no args)" },
    { label: "main argc",      insert: "int main(int argc, char *argv[]) {\n\t${1}\n\treturn 0;\n}", detail: "main function with arguments" },

    // I/O functions
    { label: "printf",         insert: "printf(\"${1:%s}\\n\", ${2});",                      detail: "formatted print to stdout" },
    { label: "fprintf",        insert: "fprintf(${1:stderr}, \"${2:%s}\\n\", ${3});",        detail: "formatted print to stream" },
    { label: "scanf",          insert: "scanf(\"${1:%d}\", &${2:var});",                     detail: "formatted read from stdin" },
    { label: "fgets",          insert: "fgets(${1:buf}, sizeof(${1:buf}), stdin);",           detail: "read line from stream" },
    { label: "puts",           insert: "puts(${1:str});",                                    detail: "print string + newline" },
    { label: "getchar",        insert: "getchar()",                                          detail: "read one character from stdin" },
    { label: "putchar",        insert: "putchar(${1:c});",                                   detail: "write one character to stdout" },
    { label: "perror",         insert: "perror(\"${1:message}\");",                          detail: "print error message (errno)" },

    // Memory management
    { label: "malloc",         insert: "malloc(${1:size})",                                  detail: "allocate heap memory" },
    { label: "calloc",         insert: "calloc(${1:count}, ${2:size})",                      detail: "allocate zero-initialised heap memory" },
    { label: "realloc",        insert: "realloc(${1:ptr}, ${2:new_size})",                   detail: "resize allocated memory" },
    { label: "free",           insert: "free(${1:ptr});",                                    detail: "release heap memory" },

    // String functions (string.h)
    { label: "strlen",         insert: "strlen(${1:str})",                                   detail: "string.h: length of string" },
    { label: "strcpy",         insert: "strcpy(${1:dest}, ${2:src});",                       detail: "string.h: copy string" },
    { label: "strncpy",        insert: "strncpy(${1:dest}, ${2:src}, ${3:n});",              detail: "string.h: copy at most n chars" },
    { label: "strcat",         insert: "strcat(${1:dest}, ${2:src});",                       detail: "string.h: concatenate strings" },
    { label: "strcmp",         insert: "strcmp(${1:s1}, ${2:s2})",                           detail: "string.h: compare strings (0 = equal)" },
    { label: "strncmp",        insert: "strncmp(${1:s1}, ${2:s2}, ${3:n})",                  detail: "string.h: compare at most n chars" },
    { label: "strchr",         insert: "strchr(${1:str}, ${2:c})",                           detail: "string.h: find char in string" },
    { label: "strstr",         insert: "strstr(${1:haystack}, ${2:needle})",                 detail: "string.h: find substring" },
    { label: "memset",         insert: "memset(${1:ptr}, ${2:0}, ${3:size});",               detail: "string.h: fill memory with a byte value" },
    { label: "memcpy",         insert: "memcpy(${1:dest}, ${2:src}, ${3:size});",            detail: "string.h: copy memory block" },

    // Type definitions and control flow
    { label: "struct",         insert: "struct ${1:Name} {\n\t${2:int field};\n};",          detail: "struct definition" },
    { label: "typedef struct", insert: "typedef struct {\n\t${2:int field};\n} ${1:Name};", detail: "typedef struct" },
    { label: "enum",           insert: "enum ${1:Name} {\n\t${2:VALUE},\n};",               detail: "enum definition" },
    { label: "typedef enum",   insert: "typedef enum {\n\t${2:VALUE},\n} ${1:Name};",       detail: "typedef enum" },
    { label: "if",             insert: "if (${1:condition}) {\n\t${2}\n}",                  detail: "if statement" },
    { label: "if/else",        insert: "if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}", detail: "if/else statement" },
    { label: "for",            insert: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}", detail: "for loop" },
    { label: "while",          insert: "while (${1:condition}) {\n\t${2}\n}",               detail: "while loop" },
    { label: "do while",       insert: "do {\n\t${1}\n} while (${2:condition});",           detail: "do-while loop" },
    { label: "switch",         insert: "switch (${1:expr}) {\n\tcase ${2:0}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}", detail: "switch statement" },
    { label: "fn",             insert: "${1:int} ${2:name}(${3}) {\n\t${4}\n\treturn ${5:0};\n}", detail: "function definition" },
    { label: "ptr",            insert: "${1:int} *${2:ptr}",                                 detail: "pointer declaration" },
    { label: "array",          insert: "${1:int} ${2:arr}[${3:size}];",                      detail: "array declaration" },
    { label: "NULL",           insert: "NULL",                                               detail: "null pointer constant" },
    { label: "sizeof",         insert: "sizeof(${1:type})",                                  detail: "size of type in bytes" },
    { label: "exit",           insert: "exit(${1:EXIT_SUCCESS});",                           detail: "terminate program" },
  ];

  monaco.languages.registerCompletionItemProvider("c", {
    triggerCharacters: [".", ">"],

    provideCompletionItems(model, position) {
      const word      = model.getWordUntilPosition(position);
      const wordRange = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      };

      const lineText = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn:     1,
        endLineNumber:   position.lineNumber,
        endColumn:       position.column,
      });

      // Skip suggestions when inside a member access (we can't do type inference)
      if (/[.>]\w*$/.test(lineText)) return { suggestions: [] };

      return {
        suggestions: SNIPPETS.map(({ label, insert, detail }) => ({
          label,
          kind:            label.startsWith("#") ? S.Module
                         : label.endsWith(")") || label.endsWith(");") ? S.Function
                         : S.Keyword,
          detail,
          insertText:      insert,
          insertTextRules: SNIPPET,
          range:           wordRange,
          sortText:        "z" + label,
        })),
      };
    },
  });
}

/* ── Init ────────────────────────────────────────────────────────────────── */
async function init() {
  await loadCourses();
  await selectCourse(state.currentCourse);
  bindUI();
}

/* ── API helpers ─────────────────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function courseApi(path, opts) {
  return api(`/api/courses/${state.currentCourse}${path}`, opts);
}

/* ── Course selector ─────────────────────────────────────────────────────── */
async function loadCourses() {
  state.courses = await api("/api/courses");
  const sel = document.getElementById("course-select");
  sel.innerHTML = "";
  state.courses.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.slug;
    opt.textContent = c.slug;
    sel.appendChild(opt);
  });
  if (state.courses.length > 0) {
    state.currentCourse = state.courses[0].slug;
    sel.value = state.currentCourse;
  }
}

async function selectCourse(slug) {
  state.currentCourse = slug;
  document.getElementById("course-select").value = slug;

  const cfg = await api(`/api/courses/${slug}/config`);
  if (cfg.language === "rust")       registerRustCompletionsOnce();
  if (cfg.language === "python")     registerPythonCompletionsOnce();
  if (cfg.language === "javascript") registerJavaScriptCompletionsOnce();
  if (cfg.language === "c")          registerCCompletionsOnce();
  monaco.editor.setModelLanguage(state.editor.getModel(), cfg.language);

  state.currentLesson = null;
  state.currentExIdx  = 0;
  state.hintIdx       = 0;
  state.editor.setValue("// select a lesson to begin");
  setOutput('<span class="muted">Your output will appear here…</span>');
  document.getElementById("description-content").innerHTML =
    '<p class="placeholder">← Select a lesson to begin</p>';
  document.getElementById("run-btn").disabled  = true;
  document.getElementById("prev-btn").disabled = true;
  document.getElementById("next-btn").disabled = true;
  document.getElementById("exercise-counter").textContent = "";

  await loadProgress();
  await loadLessons();
}

/* ── Data loaders ────────────────────────────────────────────────────────── */
async function loadLessons() {
  state.lessons = await courseApi("/lessons");
  renderSidebar();
}

async function loadLesson(id) {
  state.currentLesson = await courseApi(`/lessons/${id}`);
  state.currentExIdx  = firstIncomplete();
  state.hintIdx       = 0;
  renderExercise();
}

async function loadProgress() {
  state.progress = await courseApi("/progress");
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
function renderSidebar() {
  const ul = document.getElementById("lesson-list");
  ul.innerHTML = "";
  state.lessons.forEach((l) => {
    const li = document.createElement("li");
    const done = l.completed === l.exercise_count;
    li.innerHTML = `
      <div class="lesson-title">${l.title}</div>
      <div class="lesson-progress ${done ? "done" : ""}">
        ${l.completed}/${l.exercise_count} exercises${done ? " ✓" : ""}
      </div>`;
    li.dataset.id = l.id;
    li.addEventListener("click", () => selectLesson(l.id));
    ul.appendChild(li);
  });
}

function setActiveSidebarItem(id) {
  document.querySelectorAll("#lesson-list li").forEach((li) => {
    li.classList.toggle("active", li.dataset.id === id);
  });
}

/* ── Exercise rendering ──────────────────────────────────────────────────── */
function firstIncomplete() {
  if (!state.currentLesson) return 0;
  const pid = state.progress.completed?.[state.currentLesson.id] ?? [];
  const idx = state.currentLesson.exercises.findIndex((e) => !pid.includes(e.id));
  return idx === -1 ? 0 : idx;
}

function renderExercise() {
  const lesson = state.currentLesson;
  if (!lesson) return;

  const ex    = lesson.exercises[state.currentExIdx];
  const total = lesson.exercises.length;
  const pid   = state.progress.completed?.[lesson.id] ?? [];

  // Description panel
  const desc = document.getElementById("description-content");
  desc.innerHTML = `
    <h2>${ex.title}</h2>
    <div class="section-label">Task</div>
    <pre class="prompt">${escHtml(ex.prompt.trim())}</pre>
    <div class="section-label">Expected output</div>
    <pre class="expected">${escHtml(ex.expected_output)}</pre>
    <div id="hint-section">
      ${ex.hints.length > 0
        ? `<button id="hint-btn">💡 Show hint</button>
           <pre id="hint-text"></pre>`
        : ""}
    </div>`;

  // Hint button
  const hintBtn = document.getElementById("hint-btn");
  if (hintBtn) {
    state.hintIdx = 0;
    hintBtn.addEventListener("click", () => {
      const hints   = ex.hints;
      const hintEl  = document.getElementById("hint-text");
      const idx     = Math.min(state.hintIdx, hints.length - 1);
      hintEl.textContent = hints[idx];
      hintEl.style.display = "block";
      if (state.hintIdx < hints.length - 1) state.hintIdx++;
      hintBtn.textContent = state.hintIdx < hints.length
        ? "💡 Next hint"
        : "💡 Show hint";
    });
  }

  // Editor
  const starter = ex.starter_code ?? "fn main() {\n    \n}\n";
  state.editor.setValue(starter.trim() + "\n");
  state.editor.setPosition({ lineNumber: 3, column: 5 });
  state.editor.focus();

  // Toolbar nav
  document.getElementById("exercise-counter").textContent =
    `${state.currentExIdx + 1} / ${total}`;
  document.getElementById("prev-btn").disabled = state.currentExIdx === 0;
  document.getElementById("next-btn").disabled = state.currentExIdx === total - 1;
  document.getElementById("run-btn").disabled  = false;

  // Clear output
  setOutput('<span class="muted">Press ▶ Run to test your code…</span>');

  if (pid.includes(ex.id)) {
    setOutput('<span class="out-success">✓ Already completed — you can still run to experiment.</span>');
  }
}

/* ── Select lesson ───────────────────────────────────────────────────────── */
async function selectLesson(id) {
  setActiveSidebarItem(id);
  await loadLesson(id);
}

/* ── Run code ────────────────────────────────────────────────────────────── */
async function runCode() {
  const lesson = state.currentLesson;
  const ex     = lesson.exercises[state.currentExIdx];
  const code   = state.editor.getValue();
  const btn    = document.getElementById("run-btn");

  btn.textContent = "Running…";
  btn.classList.add("running");
  btn.disabled = true;
  setOutput('<span class="muted">Compiling…</span>');

  try {
    const result = await courseApi("/run", {
      method: "POST",
      body: JSON.stringify({ lesson_id: lesson.id, exercise_id: ex.id, code }),
    });

    renderResult(result);

    if (result.status === "success") {
      await loadProgress();
      await loadLessons();
      setActiveSidebarItem(lesson.id);
      const total = lesson.exercises.length;
      if (state.currentExIdx < total - 1) {
        setTimeout(() => {
          state.currentExIdx++;
          state.hintIdx = 0;
          renderExercise();
        }, 1200);
      }
    }
  } catch (err) {
    setOutput(`<span class="out-error">Request failed: ${escHtml(err.message)}</span>`);
  } finally {
    btn.textContent = "▶ Run";
    btn.classList.remove("running");
    btn.disabled = false;
  }
}

/* ── Result rendering ────────────────────────────────────────────────────── */
function renderResult(r) {
  switch (r.status) {
    case "success":
      setOutput('<span class="out-success">✓ Correct! Well done.</span>');
      break;

    case "wrong_output": {
      const diff = renderDiff(r.diff);
      setOutput(
        `<span class="out-error">✗ Wrong output</span>\n\n` +
        `<span class="out-diff">─── diff (- expected  + actual) ───</span>\n` +
        diff
      );
      break;
    }

    case "compile_error":
      setOutput(
        `<span class="out-error">✗ Compile error</span>\n\n` +
        escHtml(r.stderr)
      );
      break;

    case "timeout":
      setOutput(
        `<span class="out-timeout">✗ Timeout — your program ran for more than 5 seconds.\n` +
        `Make sure there are no infinite loops.</span>`
      );
      break;

    case "internal_error":
      setOutput(`<span class="out-error">Internal error: ${escHtml(r.message)}</span>`);
      break;

    default:
      setOutput(escHtml(JSON.stringify(r, null, 2)));
  }
}

function renderDiff(raw) {
  if (!raw) return "";
  return raw
    .split("\n")
    .map((line) => {
      if (line.startsWith("- "))
        return `<span class="diff-del">${escHtml(line)}</span>`;
      if (line.startsWith("+ "))
        return `<span class="diff-ins">${escHtml(line)}</span>`;
      return `<span class="diff-eq">${escHtml(line)}</span>`;
    })
    .join("\n");
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function setOutput(html) {
  document.getElementById("output-content").innerHTML = html;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ── UI bindings ─────────────────────────────────────────────────────────── */
function bindUI() {
  document.getElementById("course-select").addEventListener("change", (e) => {
    selectCourse(e.target.value);
  });

  document.getElementById("run-btn").addEventListener("click", runCode);

  document.getElementById("prev-btn").addEventListener("click", () => {
    if (state.currentExIdx > 0) {
      state.currentExIdx--;
      state.hintIdx = 0;
      renderExercise();
    }
  });

  document.getElementById("next-btn").addEventListener("click", () => {
    const total = state.currentLesson?.exercises.length ?? 0;
    if (state.currentExIdx < total - 1) {
      state.currentExIdx++;
      state.hintIdx = 0;
      renderExercise();
    }
  });

  document.getElementById("reset-btn").addEventListener("click", async () => {
    if (!confirm("Reset all progress?")) return;
    await courseApi("/progress/reset", { method: "POST" });
    await loadProgress();
    await loadLessons();
    if (state.currentLesson) renderExercise();
  });

  // Ctrl/Cmd+Enter to run
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const btn = document.getElementById("run-btn");
      if (!btn.disabled) runCode();
    }
  });
}
