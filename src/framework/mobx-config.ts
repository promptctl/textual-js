import { configure } from "mobx";

// [LAW:single-enforcer] Global MobX action enforcement is configured once,
// before any observable is created, so every mutation flows through runInAction.
configure({ enforceActions: "always" });
