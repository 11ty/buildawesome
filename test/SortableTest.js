import test from "ava";
import { DateTime } from "luxon";

import Sortable from "../src/Util/Objects/Sortable.js";

test("get Sort Function", (t) => {
  let s = new Sortable();
  t.deepEqual(s.getSortFunction(), Sortable.sortFunctionAlphabeticAscending);
});

test("Alphabetic Ascending", (t) => {
  let s = new Sortable();
  t.false(s.isSortNumeric);
  t.true(s.isSortAscending);

  s.add("a");
  s.add("z");
  s.add("m");
  t.deepEqual(s.sort(), ["a", "m", "z"]);
});

test("Alphabetic Ascending (shortcut)", (t) => {
  let s = new Sortable();
  s.add("a");
  s.add("z");
  s.add("m");
  t.deepEqual(s.sortAscending(), ["a", "m", "z"]);
});

test("Alphabetic Descending", (t) => {
  let s = new Sortable();
  s.setSortDescending();
  t.false(s.isSortNumeric);
  t.false(s.isSortAscending);

  s.add("a");
  s.add("z");
  s.add("m");
  t.deepEqual(s.sort(), ["z", "m", "a"]);
});

test("Alphabetic Descending (shortcut)", (t) => {
  let s = new Sortable();
  s.add("a");
  s.add("z");
  s.add("m");
  t.deepEqual(s.sortDescending(), ["z", "m", "a"]);
});

test("Numeric Ascending", (t) => {
  let s = new Sortable();
  s.setSortNumeric(true);
  t.true(s.isSortNumeric);
  t.true(s.isSortAscending);

  s.add(1);
  s.add(4);
  s.add(2);
  t.deepEqual(s.sort(), [1, 2, 4]);
});

test("Numeric Descending", (t) => {
  let s = new Sortable();
  s.setSortNumeric(true);
  s.setSortDescending();
  t.true(s.isSortNumeric);
  t.false(s.isSortAscending);

  s.add(1);
  s.add(4);
  s.add(2);
  t.deepEqual(s.sort(), [4, 2, 1]);
});

test("Date Assumptions", (t) => {
  t.is(DateTime.fromISO("2007-10-10") - new Date(2007, 9, 10).getTime(), 0);
  t.is(DateTime.fromISO("2008-10-10") - new Date(2008, 9, 10).getTime(), 0);
  t.not(DateTime.fromISO("2008-10-10") - new Date(2007, 9, 10).getTime(), 0);
});

test("Date and Sortable Assumptions", (t) => {
  // Sortable works here without extra code because Luxon’s valueOf works in equality comparison (for alphabetic lists)
  t.is(
    Sortable.sortFunctionAlphabeticAscending(
      DateTime.fromISO("2007-10-10"),
      new Date(2007, 9, 10).getTime()
    ),
    0
  );
  t.is(
    Sortable.sortFunctionAlphabeticDescending(
      DateTime.fromISO("2007-10-10"),
      new Date(2007, 9, 10).getTime()
    ),
    0
  );

  t.is(
    Sortable.sortFunctionAlphabeticAscending(
      DateTime.fromISO("2008-10-10"),
      new Date(2007, 9, 10).getTime()
    ),
    1
  );
  t.is(
    Sortable.sortFunctionAlphabeticDescending(
      DateTime.fromISO("2008-10-10"),
      new Date(2007, 9, 10).getTime()
    ),
    -1
  );

  // Sortable works here without extra code because Luxon’s valueOf works in subtraction (for numeric lists)
  t.is(
    Sortable.sortFunctionNumericAscending(
      DateTime.fromISO("2008-10-10"),
      new Date(2008, 9, 10).getTime()
    ),
    0
  );
  t.is(
    Sortable.sortFunctionNumericDescending(
      DateTime.fromISO("2008-10-10"),
      new Date(2008, 9, 10).getTime()
    ),
    0
  );

  t.true(
    Sortable.sortFunctionNumericAscending(
      DateTime.fromISO("2008-10-10"),
      new Date(2007, 9, 10).getTime()
    ) > 0
  );
  t.true(
    Sortable.sortFunctionNumericDescending(
      DateTime.fromISO("2008-10-10"),
      new Date(2007, 9, 10).getTime()
    ) < 0
  );
});

test("Date Ascending", (t) => {
  let s = new Sortable();
  let date1 = DateTime.fromISO("2007-10-10");
  let date2 = DateTime.fromISO("2008-10-10");
  let date3 = DateTime.fromISO("2009-10-10");
  s.add(date3);
  s.add(date2);
  s.add(date1);
  t.deepEqual(s.sort(), [date1, date2, date3]);
});

test("Date Descending", (t) => {
  let s = new Sortable();
  s.setSortDescending();
  let date1 = DateTime.fromISO("2007-10-10");
  let date2 = DateTime.fromISO("2008-10-10");
  let date3 = DateTime.fromISO("2009-10-10");
  s.add(date2);
  s.add(date3);
  s.add(date1);
  t.deepEqual(s.sort(), [date3, date2, date1]);
});

test("Alphabetic Ascending (short str sort arg)", (t) => {
  let s = new Sortable();
  s.add("a");
  s.add("z");
  s.add("m");
  t.deepEqual(s.sort("A-Z"), ["a", "m", "z"]);
});

test("Alphabetic Descending (short str sort arg)", (t) => {
  let s = new Sortable();
  s.add("a");
  s.add("z");
  s.add("m");
  t.deepEqual(s.sort("Z-A"), ["z", "m", "a"]);
});

test("Invalid Sort Function Name", (t) => {
  let s = new Sortable();
  t.throws(() => s.sort("INVALID SORT STRING"));
});

test("Ascending / Descending Sorting Setters (asc, no param)", (t) => {
  let s = new Sortable();
  s.isSortAscending = false;
  s.setSortAscending();
  t.is(s.isSortAscending, true);
});

test("Ascending / Descending Sorting Setters (desc, no param)", (t) => {
  let s = new Sortable();
  s.isSortAscending = true;
  s.setSortDescending();
  t.is(s.isSortAscending, false);
});

test("Ascending / Descending Sorting Setters (asc, true)", (t) => {
  let s = new Sortable();
  s.isSortAscending = false;
  s.setSortAscending(true);
  t.is(s.isSortAscending, true);
});

test("Ascending / Descending Sorting Setters (asc, false)", (t) => {
  let s = new Sortable();
  s.isSortAscending = true;
  s.setSortAscending(false);
  t.is(s.isSortAscending, false);
});

test("Ascending / Descending Sorting Setters (desc, true)", (t) => {
  let s = new Sortable();
  s.isSortAscending = true;
  s.setSortDescending(true);
  t.is(s.isSortAscending, false);
});

test("Ascending / Descending Sorting Setters (desc, false)", (t) => {
  let s = new Sortable();
  s.isSortAscending = false;
  s.setSortDescending(false);
  t.is(s.isSortAscending, true);
});
