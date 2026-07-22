import 'package:flutter/material.dart';

/// Below this width: phone/mobile layout (bottom nav, stacked hero). At/above: desktop-web
/// layout (side nav rail, split hero+form) — anh's feedback 2026-07-22: the earlier fixed
/// 480px letterbox on wide browsers "trông như app mobile" (looked like a boxed-in mobile
/// app); a real responsive layout that uses the available width reads as an actual website.
const kWideBreakpoint = 900.0;

bool isWideScreen(BuildContext context) =>
    MediaQuery.sizeOf(context).width >= kWideBreakpoint;
