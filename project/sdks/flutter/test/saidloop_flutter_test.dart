import 'package:saidloop_flutter/saidloop_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final calls = <MethodCall>[];

  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Saidloop.channel, (call) async {
      calls.add(call);
      return null;
    });
  });

  test('init forwards key, api and options', () async {
    await Saidloop.init(key: 'pk_test', api: 'http://localhost:8080');
    expect(calls.single.method, 'init');
    expect(calls.single.arguments, {
      'key': 'pk_test',
      'api': 'http://localhost:8080',
      'shakeToReport': true,
      'maskTextInputs': true,
    });
  });

  test('init rejects secret-looking keys', () {
    expect(() => Saidloop.init(key: 'cl_mcp_secret'), throwsArgumentError);
  });

  test('identify leaves out empty fields', () async {
    await Saidloop.identify(userId: 'rina');
    expect(calls.single.arguments, {'userId': 'rina'});
  });

  testWidgets('show sends masked rectangles before opening the sheet', (tester) async {
    await tester.pumpWidget(const Directionality(
      textDirection: TextDirection.ltr,
      child: Center(
        child: SaidloopMask(child: SizedBox(width: 120, height: 40)),
      ),
    ));
    await Saidloop.show();
    expect(calls.map((c) => c.method), ['setMaskRects', 'show']);
    final rects = (calls.first.arguments as Map)['rects'] as List;
    expect(rects.single, {'x': 340.0, 'y': 280.0, 'w': 120.0, 'h': 40.0});

    // Unmounting clears the mask on the native side once the debounce runs.
    calls.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(milliseconds: 200));
    expect(calls.single.method, 'setMaskRects');
    expect((calls.single.arguments as Map)['rects'], isEmpty);
  });
}
