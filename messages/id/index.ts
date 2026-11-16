import { defineCatalogue } from "../define-catalogue";
import about from "./about.json";
import account from "./account.json";
import archive from "./archive.json";
import auth from "./auth.json";
import common from "./common.json";
import companion from "./companion.json";
import docs from "./docs.json";
import home from "./home.json";
import legal from "./legal.json";
import planner from "./planner.json";
import quiz from "./quiz.json";
import studyTools from "./study-tools.json";
import syllabus from "./syllabus.json";
import updates from "./updates.json";
import viz from "./viz.json";

// One JSON file per feature area. Each file holds whole top-level namespaces,
// so `useTranslations("viz")` etc. never need to know which file a string
// lives in. Add a file here AND in the other locale's index.ts.
export default defineCatalogue(
  about,
  account,
  archive,
  auth,
  common,
  companion,
  docs,
  home,
  legal,
  planner,
  quiz,
  studyTools,
  syllabus,
  updates,
  viz,
);
