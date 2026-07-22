import 'package:flutter/material.dart';

/// Below this width: phone/mobile layout (bottom nav, stacked hero). At/above: desktop-web
/// layout (side nav, split hero+form) — same breakpoint/rationale as mobile-app-citizen's
/// core/responsive.dart, kept identical across both apps.
const kWideBreakpoint = 900.0;

bool isWideScreen(BuildContext context) =>
    MediaQuery.sizeOf(context).width >= kWideBreakpoint;
