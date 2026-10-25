import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(const DriverHubApp());
}

// Android emulator -> Windows PC.
// For a physical phone, replace this with your PC's LAN IP address.
const String apiBaseUrl = 'http://10.0.2.2:3001';

const Color brandColor = Color(0xFF0F766E);
const String sessionKey = 'driverhub_session';

class DriverHubApp extends StatelessWidget {
  const DriverHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DriverHub UG',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: brandColor),
        scaffoldBackgroundColor: const Color(0xFFF5F8F8),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFDCE5E4)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFDCE5E4)),
          ),
        ),
      ),
      home: const LoginPage(),
    );
  }
}

class ApiService {
  static Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    bool saveSession = false,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final uri = Uri.parse('$apiBaseUrl$path');

    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
    };

    final cookie = prefs.getString(sessionKey);
    if (cookie != null && cookie.isNotEmpty) {
      headers['Cookie'] = cookie;
    }

    late http.Response response;

    try {
      if (method == 'POST') {
        response = await http.post(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      } else {
        response = await http.get(uri, headers: headers);
      }
    } catch (_) {
      throw Exception(
        'Cannot reach the server. Check that the backend is running '
        'on port 3001 and that the API address is correct.',
      );
    }

    if (saveSession) {
      final setCookie = response.headers['set-cookie'];
      if (setCookie != null) {
        // Store only the cookie name/value, not its attributes.
        final cookieValue = setCookie.split(';').first;
        await prefs.setString(sessionKey, cookieValue);
      }
    }

    Map<String, dynamic> result = {};
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        result = decoded;
      }
    } catch (_) {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('The server returned an invalid response.');
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        result['error']?.toString() ??
            'Request failed (${response.statusCode}).',
      );
    }

    return result;
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(sessionKey);
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _loading = false;
  bool _hidePassword = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getString(sessionKey) == null) return;

    try {
      final result = await ApiService.request('/api/state');
      final user = result['currentUser'];

      if (!mounted) return;

      if (user is Map<String, dynamic>) {
        _openDashboard(user);
      } else {
        await ApiService.clearSession();
      }
    } catch (_) {
      await ApiService.clearSession();
    }
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await ApiService.request(
        '/api/auth/login',
        method: 'POST',
        body: {
          'email': _emailController.text.trim(),
          'password': _passwordController.text,
        },
        saveSession: true,
      );

      final user = result['currentUser'];

      if (user is! Map<String, dynamic>) {
        throw Exception('Login succeeded, but no user profile was returned.');
      }

      if (!mounted) return;
      _openDashboard(user);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openDashboard(Map<String, dynamic> user) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => DashboardPage(user: user)),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      height: 76,
                      width: 76,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: brandColor,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: const Icon(
                        Icons.local_shipping_rounded,
                        color: Colors.white,
                        size: 40,
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'DriverHub UG',
                      style: TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF173B38),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Sign in to continue to your hub.',
                      style: TextStyle(fontSize: 16, color: Colors.black54),
                    ),
                    const SizedBox(height: 32),
                    const Text(
                      'Email address',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.username],
                      decoration: const InputDecoration(
                        hintText: 'you@example.com',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                      validator: (value) {
                        final email = value?.trim() ?? '';
                        if (email.isEmpty || !email.contains('@')) {
                          return 'Enter a valid email address.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Password',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _hidePassword,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(
                        hintText: 'Enter your password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          onPressed: () =>
                              setState(() => _hidePassword = !_hidePassword),
                          icon: Icon(
                            _hidePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Enter your password.';
                        }
                        return null;
                      },
                      onFieldSubmitted: (_) => _login(),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFEEEE),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    SizedBox(
                      height: 54,
                      child: FilledButton(
                        onPressed: _loading ? null : _login,
                        style: FilledButton.styleFrom(
                          backgroundColor: brandColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: _loading
                            ? const SizedBox(
                                height: 22,
                                width: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Sign in',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Secure access to your DriverHub account.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.black45),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class DashboardPage extends StatefulWidget {
  final Map<String, dynamic> user;

  const DashboardPage({super.key, required this.user});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late Map<String, dynamic> _user;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
  }

  bool _refreshing = false;
  String? _message;

  String _firstValue(List<String> keys, {String fallback = 'User'}) {
    for (final key in keys) {
      final value = _user[key]?.toString().trim();
      if (value != null && value.isNotEmpty && value != 'null') {
        return value;
      }
    }
    return fallback;
  }

  Future<void> _refresh() async {
    setState(() {
      _refreshing = true;
      _message = null;
    });

    try {
      final result = await ApiService.request('/api/state');
      final user = result['currentUser'];

      if (user is Map<String, dynamic>) {
        setState(() => _user = user);
      } else {
        throw Exception('The server did not return a user profile.');
      }
    } catch (error) {
      setState(() {
        _message = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _logout() async {
    setState(() => _refreshing = true);

    try {
      await ApiService.request('/api/auth/logout', method: 'POST', body: {});
    } catch (_) {
      // Clear the local session even if the server is unreachable.
    } finally {
      await ApiService.clearSession();
    }

    if (!mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginPage()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = _firstValue([
      'name',
      'fullName',
      'displayName',
      'firstName',
      'email',
    ]);
    final email = _firstValue(['email'], fallback: 'No email provided');
    final role = _firstValue([
      'role',
      'accountType',
      'userType',
    ], fallback: 'Member');

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'DriverHub UG',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Refresh account',
            onPressed: _refreshing ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Sign out',
            onPressed: _logout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: brandColor,
                borderRadius: BorderRadius.circular(22),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.waving_hand_rounded,
                    color: Colors.white,
                    size: 34,
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Welcome back,',
                    style: TextStyle(color: Colors.white70, fontSize: 16),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 25,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Your hub, wherever you go.',
                    style: TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Your account',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _InfoCard(
              icon: Icons.person_outline,
              title: 'Account name',
              value: name,
            ),
            _InfoCard(
              icon: Icons.email_outlined,
              title: 'Email address',
              value: email,
            ),
            _InfoCard(
              icon: Icons.badge_outlined,
              title: 'Account type',
              value: role,
            ),
            const SizedBox(height: 12),
            if (_message != null)
              Card(
                color: const Color(0xFFFFEEEE),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    _message!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              ),
            if (_refreshing)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _logout,
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
            ),
            const SizedBox(height: 20),
            const Text(
              'More DriverHub features can be added here using your existing API.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;

  const _InfoCard({
    required this.icon,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFE0F2F1),
          child: Icon(icon, color: brandColor),
        ),
        title: Text(title, style: const TextStyle(color: Colors.black54)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            value,
            style: const TextStyle(
              color: Color(0xFF173B38),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
