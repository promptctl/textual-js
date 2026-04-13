# Source Coverage Matrix

This matrix maps every Python module under `src/textual` to the spec file that owns its behavior description.

// [LAW:one-source-of-truth] Coverage ownership is defined from concrete modules in `src/textual`, not from documentation categories.

## Coverage Summary

- Total mapped modules: `247`
- `spec/00-overview-and-scope.md`: `1` modules
- `spec/01-runtime-app-and-lifecycle.md`: `2` modules
- `spec/02-dom-reactivity-and-query.md`: `4` modules
- `spec/03-message-event-and-dispatch.md`: `6` modules
- `spec/04-styling-and-css-engine.md`: `20` modules
- `spec/05-layout-render-and-compositor.md`: `12` modules
- `spec/06-input-bindings-actions-and-commands.md`: `7` modules
- `spec/07-workers-timers-and-signals.md`: `5` modules
- `spec/08-drivers-io-and-platform-behavior.md`: `13` modules
- `spec/09-widget-base-contract.md`: `4` modules
- `spec/10-widget-catalog.md`: `56` modules
- `spec/11-text-editing-and-document-model.md`: `11` modules
- `spec/12-supporting-subsystems.md`: `100` modules
- `spec/13-testability-and-automation-surfaces.md`: `6` modules

## Module to Spec Ownership

| Module | Source Path | Owning Spec |
| --- | --- | --- |
| `textual.__init__` | `__init__.py` | `spec/00-overview-and-scope.md` |
| `textual.__main__` | `__main__.py` | `spec/13-testability-and-automation-surfaces.md` |
| `textual._animator` | `_animator.py` | `spec/12-supporting-subsystems.md` |
| `textual._ansi_sequences` | `_ansi_sequences.py` | `spec/12-supporting-subsystems.md` |
| `textual._ansi_theme` | `_ansi_theme.py` | `spec/12-supporting-subsystems.md` |
| `textual._arrange` | `_arrange.py` | `spec/05-layout-render-and-compositor.md` |
| `textual._auto_scroll` | `_auto_scroll.py` | `spec/12-supporting-subsystems.md` |
| `textual._binary_encode` | `_binary_encode.py` | `spec/12-supporting-subsystems.md` |
| `textual._border` | `_border.py` | `spec/12-supporting-subsystems.md` |
| `textual._box_drawing` | `_box_drawing.py` | `spec/12-supporting-subsystems.md` |
| `textual._callback` | `_callback.py` | `spec/12-supporting-subsystems.md` |
| `textual._cells` | `_cells.py` | `spec/12-supporting-subsystems.md` |
| `textual._color_constants` | `_color_constants.py` | `spec/12-supporting-subsystems.md` |
| `textual._compat` | `_compat.py` | `spec/12-supporting-subsystems.md` |
| `textual._compositor` | `_compositor.py` | `spec/05-layout-render-and-compositor.md` |
| `textual._context` | `_context.py` | `spec/12-supporting-subsystems.md` |
| `textual._debug` | `_debug.py` | `spec/12-supporting-subsystems.md` |
| `textual._dispatch_key` | `_dispatch_key.py` | `spec/06-input-bindings-actions-and-commands.md` |
| `textual._doc` | `_doc.py` | `spec/12-supporting-subsystems.md` |
| `textual._duration` | `_duration.py` | `spec/12-supporting-subsystems.md` |
| `textual._easing` | `_easing.py` | `spec/12-supporting-subsystems.md` |
| `textual._event_broker` | `_event_broker.py` | `spec/03-message-event-and-dispatch.md` |
| `textual._extrema` | `_extrema.py` | `spec/12-supporting-subsystems.md` |
| `textual._files` | `_files.py` | `spec/12-supporting-subsystems.md` |
| `textual._immutable_sequence_view` | `_immutable_sequence_view.py` | `spec/12-supporting-subsystems.md` |
| `textual._import_app` | `_import_app.py` | `spec/13-testability-and-automation-surfaces.md` |
| `textual._keyboard_protocol` | `_keyboard_protocol.py` | `spec/12-supporting-subsystems.md` |
| `textual._layout_resolve` | `_layout_resolve.py` | `spec/05-layout-render-and-compositor.md` |
| `textual._line_split` | `_line_split.py` | `spec/12-supporting-subsystems.md` |
| `textual._log` | `_log.py` | `spec/12-supporting-subsystems.md` |
| `textual._loop` | `_loop.py` | `spec/12-supporting-subsystems.md` |
| `textual._markup_playground` | `_markup_playground.py` | `spec/12-supporting-subsystems.md` |
| `textual._node_list` | `_node_list.py` | `spec/12-supporting-subsystems.md` |
| `textual._on` | `_on.py` | `spec/03-message-event-and-dispatch.md` |
| `textual._opacity` | `_opacity.py` | `spec/12-supporting-subsystems.md` |
| `textual._parser` | `_parser.py` | `spec/12-supporting-subsystems.md` |
| `textual._partition` | `_partition.py` | `spec/05-layout-render-and-compositor.md` |
| `textual._path` | `_path.py` | `spec/12-supporting-subsystems.md` |
| `textual._profile` | `_profile.py` | `spec/12-supporting-subsystems.md` |
| `textual._queue` | `_queue.py` | `spec/12-supporting-subsystems.md` |
| `textual._resolve` | `_resolve.py` | `spec/05-layout-render-and-compositor.md` |
| `textual._segment_tools` | `_segment_tools.py` | `spec/12-supporting-subsystems.md` |
| `textual._sleep` | `_sleep.py` | `spec/12-supporting-subsystems.md` |
| `textual._slug` | `_slug.py` | `spec/12-supporting-subsystems.md` |
| `textual._spatial_map` | `_spatial_map.py` | `spec/12-supporting-subsystems.md` |
| `textual._styles_cache` | `_styles_cache.py` | `spec/12-supporting-subsystems.md` |
| `textual._text_area_theme` | `_text_area_theme.py` | `spec/11-text-editing-and-document-model.md` |
| `textual._time` | `_time.py` | `spec/12-supporting-subsystems.md` |
| `textual._tree_sitter` | `_tree_sitter.py` | `spec/11-text-editing-and-document-model.md` |
| `textual._two_way_dict` | `_two_way_dict.py` | `spec/12-supporting-subsystems.md` |
| `textual._types` | `_types.py` | `spec/12-supporting-subsystems.md` |
| `textual._wait` | `_wait.py` | `spec/13-testability-and-automation-surfaces.md` |
| `textual._widget_navigation` | `_widget_navigation.py` | `spec/12-supporting-subsystems.md` |
| `textual._win_sleep` | `_win_sleep.py` | `spec/12-supporting-subsystems.md` |
| `textual._work_decorator` | `_work_decorator.py` | `spec/07-workers-timers-and-signals.md` |
| `textual._wrap` | `_wrap.py` | `spec/12-supporting-subsystems.md` |
| `textual._xterm_parser` | `_xterm_parser.py` | `spec/12-supporting-subsystems.md` |
| `textual.actions` | `actions.py` | `spec/06-input-bindings-actions-and-commands.md` |
| `textual.app` | `app.py` | `spec/01-runtime-app-and-lifecycle.md` |
| `textual.await_complete` | `await_complete.py` | `spec/13-testability-and-automation-surfaces.md` |
| `textual.await_remove` | `await_remove.py` | `spec/13-testability-and-automation-surfaces.md` |
| `textual.binding` | `binding.py` | `spec/06-input-bindings-actions-and-commands.md` |
| `textual.box_model` | `box_model.py` | `spec/12-supporting-subsystems.md` |
| `textual.cache` | `cache.py` | `spec/12-supporting-subsystems.md` |
| `textual.canvas` | `canvas.py` | `spec/12-supporting-subsystems.md` |
| `textual.case` | `case.py` | `spec/12-supporting-subsystems.md` |
| `textual.clock` | `clock.py` | `spec/12-supporting-subsystems.md` |
| `textual.color` | `color.py` | `spec/12-supporting-subsystems.md` |
| `textual.command` | `command.py` | `spec/06-input-bindings-actions-and-commands.md` |
| `textual.compose` | `compose.py` | `spec/12-supporting-subsystems.md` |
| `textual.constants` | `constants.py` | `spec/12-supporting-subsystems.md` |
| `textual.containers` | `containers.py` | `spec/09-widget-base-contract.md` |
| `textual.content` | `content.py` | `spec/12-supporting-subsystems.md` |
| `textual.coordinate` | `coordinate.py` | `spec/12-supporting-subsystems.md` |
| `textual.css.__init__` | `css/__init__.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css._error_tools` | `css/_error_tools.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css._help_renderables` | `css/_help_renderables.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css._help_text` | `css/_help_text.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css._style_properties` | `css/_style_properties.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css._styles_builder` | `css/_styles_builder.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.constants` | `css/constants.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.errors` | `css/errors.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.match` | `css/match.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.model` | `css/model.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.parse` | `css/parse.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.query` | `css/query.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.scalar` | `css/scalar.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.scalar_animation` | `css/scalar_animation.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.styles` | `css/styles.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.stylesheet` | `css/stylesheet.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.tokenize` | `css/tokenize.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.tokenizer` | `css/tokenizer.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.transition` | `css/transition.py` | `spec/04-styling-and-css-engine.md` |
| `textual.css.types` | `css/types.py` | `spec/04-styling-and-css-engine.md` |
| `textual.demo.__main__` | `demo/__main__.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo._project_data` | `demo/_project_data.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo._project_stargazer_updater` | `demo/_project_stargazer_updater.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo._project_stars` | `demo/_project_stars.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo.data` | `demo/data.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo.demo_app` | `demo/demo_app.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo.game` | `demo/game.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo.home` | `demo/home.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo.page` | `demo/page.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo.projects` | `demo/projects.py` | `spec/12-supporting-subsystems.md` |
| `textual.demo.widgets` | `demo/widgets.py` | `spec/12-supporting-subsystems.md` |
| `textual.design` | `design.py` | `spec/12-supporting-subsystems.md` |
| `textual.document.__init__` | `document/__init__.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.document._document` | `document/_document.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.document._document_navigator` | `document/_document_navigator.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.document._edit` | `document/_edit.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.document._history` | `document/_history.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.document._syntax_aware_document` | `document/_syntax_aware_document.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.document._wrapped_document` | `document/_wrapped_document.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.dom` | `dom.py` | `spec/02-dom-reactivity-and-query.md` |
| `textual.driver` | `driver.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers.__init__` | `drivers/__init__.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers._byte_stream` | `drivers/_byte_stream.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers._input_reader` | `drivers/_input_reader.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers._input_reader_linux` | `drivers/_input_reader_linux.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers._input_reader_windows` | `drivers/_input_reader_windows.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers._writer_thread` | `drivers/_writer_thread.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers.headless_driver` | `drivers/headless_driver.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers.linux_driver` | `drivers/linux_driver.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers.linux_inline_driver` | `drivers/linux_inline_driver.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers.web_driver` | `drivers/web_driver.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers.win32` | `drivers/win32.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.drivers.windows_driver` | `drivers/windows_driver.py` | `spec/08-drivers-io-and-platform-behavior.md` |
| `textual.errors` | `errors.py` | `spec/12-supporting-subsystems.md` |
| `textual.eta` | `eta.py` | `spec/12-supporting-subsystems.md` |
| `textual.events` | `events.py` | `spec/03-message-event-and-dispatch.md` |
| `textual.expand_tabs` | `expand_tabs.py` | `spec/12-supporting-subsystems.md` |
| `textual.features` | `features.py` | `spec/12-supporting-subsystems.md` |
| `textual.file_monitor` | `file_monitor.py` | `spec/12-supporting-subsystems.md` |
| `textual.filter` | `filter.py` | `spec/12-supporting-subsystems.md` |
| `textual.fuzzy` | `fuzzy.py` | `spec/06-input-bindings-actions-and-commands.md` |
| `textual.geometry` | `geometry.py` | `spec/12-supporting-subsystems.md` |
| `textual.getters` | `getters.py` | `spec/02-dom-reactivity-and-query.md` |
| `textual.highlight` | `highlight.py` | `spec/12-supporting-subsystems.md` |
| `textual.keys` | `keys.py` | `spec/06-input-bindings-actions-and-commands.md` |
| `textual.layout` | `layout.py` | `spec/05-layout-render-and-compositor.md` |
| `textual.layouts.__init__` | `layouts/__init__.py` | `spec/05-layout-render-and-compositor.md` |
| `textual.layouts.factory` | `layouts/factory.py` | `spec/05-layout-render-and-compositor.md` |
| `textual.layouts.grid` | `layouts/grid.py` | `spec/05-layout-render-and-compositor.md` |
| `textual.layouts.horizontal` | `layouts/horizontal.py` | `spec/05-layout-render-and-compositor.md` |
| `textual.layouts.stream` | `layouts/stream.py` | `spec/05-layout-render-and-compositor.md` |
| `textual.layouts.vertical` | `layouts/vertical.py` | `spec/05-layout-render-and-compositor.md` |
| `textual.lazy` | `lazy.py` | `spec/12-supporting-subsystems.md` |
| `textual.logging` | `logging.py` | `spec/12-supporting-subsystems.md` |
| `textual.map_geometry` | `map_geometry.py` | `spec/12-supporting-subsystems.md` |
| `textual.markup` | `markup.py` | `spec/12-supporting-subsystems.md` |
| `textual.message` | `message.py` | `spec/03-message-event-and-dispatch.md` |
| `textual.message_pump` | `message_pump.py` | `spec/03-message-event-and-dispatch.md` |
| `textual.messages` | `messages.py` | `spec/03-message-event-and-dispatch.md` |
| `textual.notifications` | `notifications.py` | `spec/12-supporting-subsystems.md` |
| `textual.pad` | `pad.py` | `spec/12-supporting-subsystems.md` |
| `textual.pilot` | `pilot.py` | `spec/13-testability-and-automation-surfaces.md` |
| `textual.reactive` | `reactive.py` | `spec/02-dom-reactivity-and-query.md` |
| `textual.render` | `render.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.__init__` | `renderables/__init__.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables._blend_colors` | `renderables/_blend_colors.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.background_screen` | `renderables/background_screen.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.bar` | `renderables/bar.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.blank` | `renderables/blank.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.digits` | `renderables/digits.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.gradient` | `renderables/gradient.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.sparkline` | `renderables/sparkline.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.styled` | `renderables/styled.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.text_opacity` | `renderables/text_opacity.py` | `spec/12-supporting-subsystems.md` |
| `textual.renderables.tint` | `renderables/tint.py` | `spec/12-supporting-subsystems.md` |
| `textual.rlock` | `rlock.py` | `spec/12-supporting-subsystems.md` |
| `textual.screen` | `screen.py` | `spec/01-runtime-app-and-lifecycle.md` |
| `textual.scroll_view` | `scroll_view.py` | `spec/09-widget-base-contract.md` |
| `textual.scrollbar` | `scrollbar.py` | `spec/09-widget-base-contract.md` |
| `textual.selection` | `selection.py` | `spec/12-supporting-subsystems.md` |
| `textual.signal` | `signal.py` | `spec/07-workers-timers-and-signals.md` |
| `textual.strip` | `strip.py` | `spec/12-supporting-subsystems.md` |
| `textual.style` | `style.py` | `spec/12-supporting-subsystems.md` |
| `textual.suggester` | `suggester.py` | `spec/12-supporting-subsystems.md` |
| `textual.suggestions` | `suggestions.py` | `spec/12-supporting-subsystems.md` |
| `textual.system_commands` | `system_commands.py` | `spec/06-input-bindings-actions-and-commands.md` |
| `textual.theme` | `theme.py` | `spec/12-supporting-subsystems.md` |
| `textual.timer` | `timer.py` | `spec/07-workers-timers-and-signals.md` |
| `textual.types` | `types.py` | `spec/12-supporting-subsystems.md` |
| `textual.validation` | `validation.py` | `spec/12-supporting-subsystems.md` |
| `textual.visual` | `visual.py` | `spec/12-supporting-subsystems.md` |
| `textual.walk` | `walk.py` | `spec/02-dom-reactivity-and-query.md` |
| `textual.widget` | `widget.py` | `spec/09-widget-base-contract.md` |
| `textual.widgets.__init__` | `widgets/__init__.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._button` | `widgets/_button.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._checkbox` | `widgets/_checkbox.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._collapsible` | `widgets/_collapsible.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._content_switcher` | `widgets/_content_switcher.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._data_table` | `widgets/_data_table.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._digits` | `widgets/_digits.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._directory_tree` | `widgets/_directory_tree.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._footer` | `widgets/_footer.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._header` | `widgets/_header.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._help_panel` | `widgets/_help_panel.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._input` | `widgets/_input.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._key_panel` | `widgets/_key_panel.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._label` | `widgets/_label.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._link` | `widgets/_link.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._list_item` | `widgets/_list_item.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._list_view` | `widgets/_list_view.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._loading_indicator` | `widgets/_loading_indicator.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._log` | `widgets/_log.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._markdown` | `widgets/_markdown.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._markdown_viewer` | `widgets/_markdown_viewer.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._masked_input` | `widgets/_masked_input.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._option_list` | `widgets/_option_list.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._placeholder` | `widgets/_placeholder.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._pretty` | `widgets/_pretty.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._progress_bar` | `widgets/_progress_bar.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._radio_button` | `widgets/_radio_button.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._radio_set` | `widgets/_radio_set.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._rich_log` | `widgets/_rich_log.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._rule` | `widgets/_rule.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._select` | `widgets/_select.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._selection_list` | `widgets/_selection_list.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._sparkline` | `widgets/_sparkline.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._static` | `widgets/_static.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._switch` | `widgets/_switch.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._tab` | `widgets/_tab.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._tab_pane` | `widgets/_tab_pane.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._tabbed_content` | `widgets/_tabbed_content.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._tabs` | `widgets/_tabs.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._text_area` | `widgets/_text_area.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.widgets._toast` | `widgets/_toast.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._toggle_button` | `widgets/_toggle_button.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._tooltip` | `widgets/_tooltip.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._tree` | `widgets/_tree.py` | `spec/10-widget-catalog.md` |
| `textual.widgets._welcome` | `widgets/_welcome.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.button` | `widgets/button.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.collapsible` | `widgets/collapsible.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.data_table` | `widgets/data_table.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.directory_tree` | `widgets/directory_tree.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.input` | `widgets/input.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.markdown` | `widgets/markdown.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.option_list` | `widgets/option_list.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.rule` | `widgets/rule.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.select` | `widgets/select.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.selection_list` | `widgets/selection_list.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.tabbed_content` | `widgets/tabbed_content.py` | `spec/10-widget-catalog.md` |
| `textual.widgets.text_area` | `widgets/text_area.py` | `spec/11-text-editing-and-document-model.md` |
| `textual.widgets.tree` | `widgets/tree.py` | `spec/10-widget-catalog.md` |
| `textual.worker` | `worker.py` | `spec/07-workers-timers-and-signals.md` |
| `textual.worker_manager` | `worker_manager.py` | `spec/07-workers-timers-and-signals.md` |

## Audit Notes

- Every `src/textual/**/*.py` module is assigned to exactly one owning spec file.
- `spec/00-overview-and-scope.md` owns the root package surface in `textual.__init__` and provides cross-cutting architectural context for the rest of the spec set.
- Demo modules (`textual.demo.*`) are mapped to supporting subsystems because they compose existing runtime APIs rather than define core contracts.

// [LAW:verifiable-goals] Completeness is mechanically verifiable by comparing this table against `find src/textual -name "*.py"`.
