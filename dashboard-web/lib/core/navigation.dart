import 'package:flutter/material.dart';

/// Lets non-widget code (ApiClient's session-expiry handling) redirect the app back to
/// the login screen without threading BuildContext through the repository layer.
final dashboardNavigatorKey = GlobalKey<NavigatorState>();
