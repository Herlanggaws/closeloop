import 'package:saidloop_flutter/saidloop_flutter.dart';
import 'package:flutter/material.dart';

// Run with: flutter run --dart-define=SAIDLOOP_KEY=pk_… --dart-define=SAIDLOOP_API=http://10.0.2.2:8080
const _key = String.fromEnvironment('SAIDLOOP_KEY', defaultValue: 'pk_demo');
const _api = String.fromEnvironment('SAIDLOOP_API', defaultValue: 'http://localhost:8080');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Saidloop.init(key: _key, api: _api);
  await Saidloop.identify(userId: 'sample_user', appVersion: '1.0');
  runApp(const SampleApp());
}

class SampleApp extends StatelessWidget {
  const SampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Bear Budget Flutter', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),
                const SaidloopMask(
                  child: Text('Rp 12.450.000', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 16),
                FilledButton(onPressed: Saidloop.show, child: const Text('Report a problem')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
