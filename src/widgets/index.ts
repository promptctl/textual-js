// [LAW:one-source-of-truth] Public widget catalog exports use Textual widget
// names for React components. State models stay in their implementation
// modules with `Model` names and are not re-exported here.
export { Button, type ButtonProps } from "./button-component.js";
export { ButtonPressed, type ButtonVariant } from "./button.js";
export { Static, type StaticProps } from "./static-component.js";
export type { ContentSource } from "./content-widget.js";
export { Label, type LabelProps } from "./label-component.js";
export { Link, type LinkProps } from "./link-component.js";
export { Digits, type DigitsProps } from "./digits-component.js";
export { Placeholder, type PlaceholderProps } from "./placeholder-component.js";
export {
  LoadingIndicator,
  type LoadingIndicatorProps,
} from "./loading-indicator-component.js";
export { InvalidPlaceholderVariant, type PlaceholderVariant } from "./placeholder.js";
export { Input, type InputProps, type InputHandle } from "./input-component.js";
export { InputChanged, InputSubmitted } from "./input.js";
export { Switch, type SwitchProps } from "./switch-component.js";
export { SwitchChanged } from "./switch.js";
export { Footer, FooterKey, type FooterKeyProps, type FooterProps } from "./footer-component.js";
export { Header, type HeaderProps } from "./header-component.js";
export { Rule, type RuleProps } from "./rule-component.js";
export { InvalidLineStyle, InvalidRuleOrientation, type RuleOrientation } from "./rule.js";
export { ProgressBar, type ProgressBarProps } from "./progress-bar-component.js";
export { Checkbox, type CheckboxProps } from "./checkbox-component.js";
export { RadioButton, type RadioButtonProps } from "./radio-button-component.js";
export {
  RadioSet,
  type RadioSetButtonSpec,
  type RadioSetProps,
} from "./radio-set-component.js";
export { RadioSetChanged } from "./radio-set.js";
export { ToggleChanged } from "./toggle.js";
export {
  Sparkline,
  type SparklineProps,
  type SparklineSummaryName,
} from "./sparkline-component.js";
export {
  type SummaryFunction,
  summaryMax,
  summaryMin,
} from "./sparkline.js";
