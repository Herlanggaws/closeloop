/// Saidloop for Flutter: forwards to the native Android and iOS SDKs.
///
/// ```dart
/// await Saidloop.init(key: "pk_…", api: "https://<your API host>");
/// Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1");
/// Saidloop.show(); // or shake the phone
///
/// SaidloopMask(child: Text(formatIDR(balance))) // hidden in screenshots
/// ```
library;

import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

class Saidloop {
  Saidloop._();

  static const MethodChannel _channel = MethodChannel('ai.closeloop/saidloop');

  /// Visible for tests.
  static MethodChannel get channel => _channel;

  static Future<void> init({
    required String key,
    String? api,
    bool shakeToReport = true,
    bool maskTextInputs = true,
  }) {
    if (!key.startsWith('pk_')) {
      throw ArgumentError("Saidloop: use your project's public key (pk_…)");
    }
    return _channel.invokeMethod('init', {
      'key': key,
      if (api != null) 'api': api,
      'shakeToReport': shakeToReport,
      'maskTextInputs': maskTextInputs,
    });
  }

  static Future<void> identify({String? userId, String? email, String? appVersion}) {
    return _channel.invokeMethod('identify', {
      if (userId != null) 'userId': userId,
      if (email != null) 'email': email,
      if (appVersion != null) 'appVersion': appVersion,
    });
  }

  /// Opens the native report sheet with a masked screenshot.
  static Future<void> show() async {
    await _MaskRegistry.instance.flush();
    await _channel.invokeMethod('show');
  }
}

/// Hides its child in Saidloop screenshots. Flutter widgets are not native views,
/// so the widget sends its on-screen rectangle to the native SDK.
class SaidloopMask extends StatefulWidget {
  const SaidloopMask({super.key, required this.child});

  final Widget child;

  @override
  State<SaidloopMask> createState() => _SaidloopMaskState();
}

class _SaidloopMaskState extends State<SaidloopMask> {
  final GlobalKey _key = GlobalKey();

  @override
  void initState() {
    super.initState();
    _MaskRegistry.instance.add(_key);
  }

  @override
  void dispose() {
    _MaskRegistry.instance.remove(_key);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _MaskRegistry.instance.schedule());
    return KeyedSubtree(key: _key, child: widget.child);
  }
}

class _MaskRegistry {
  _MaskRegistry._();

  static final _MaskRegistry instance = _MaskRegistry._();

  final Set<GlobalKey> _keys = {};
  Timer? _timer;
  List<Map<String, double>> _last = const [];

  void add(GlobalKey key) => _keys.add(key);

  void remove(GlobalKey key) {
    _keys.remove(key);
    schedule();
  }

  /// Coalesce layout changes; the native side only needs fresh rects at capture time.
  void schedule() {
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 150), flush);
  }

  /// Rectangles in logical pixels relative to the Flutter view.
  List<Map<String, double>> rects() {
    final out = <Map<String, double>>[];
    for (final key in _keys) {
      final box = key.currentContext?.findRenderObject();
      if (box is! RenderBox || !box.attached || !box.hasSize) continue;
      final o = box.localToGlobal(Offset.zero);
      out.add({'x': o.dx, 'y': o.dy, 'w': box.size.width, 'h': box.size.height});
    }
    return out;
  }

  Future<void> flush() async {
    _timer?.cancel();
    final next = rects();
    if (_sameRects(next, _last)) return;
    _last = next;
    await Saidloop.channel.invokeMethod('setMaskRects', {'rects': next});
  }

  static bool _sameRects(List<Map<String, double>> a, List<Map<String, double>> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      for (final k in const ['x', 'y', 'w', 'h']) {
        if (a[i][k] != b[i][k]) return false;
      }
    }
    return true;
  }
}
