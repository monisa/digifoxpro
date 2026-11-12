<?php
// Digifox Quiz mailer. Lives in the same folder as the quiz page (quiz/index.html).
// It stores nothing: it only sends the emails described below.
//
// Sending: through Hostinger SMTP as info@digifoxprosolutions.com, so the emails are
// DKIM-signed and pass SPF/DMARC (PHP's mail() sends unsigned from the web server,
// which is why the certificate emails were landing in spam).
// The mailbox password is NOT in this file or in the repository. It is read from
// SMTP_PASSWORD_FILE in the hosting account's home folder (outside public_html), which the
// "Publish website" GitHub Action writes from the repository secret INFO_MAIL_PASSWORD.
// If that file is missing, the emails fall back to mail() as before.

const ADMIN_EMAIL   = 'info@digifoxprosolutions.com';   // gets the "started" and "review screenshot" notices
const FROM_EMAIL    = 'info@digifoxprosolutions.com';   // must be a real mailbox on this hosting account
const FROM_NAME     = 'Digifox Pro Solutions';
const ALLOWED_HOSTS = ['digifoxprosolutions.com', 'www.digifoxprosolutions.com']; // where the quiz page lives
const PASS_MARK     = 12;
const TOTAL         = 15;

const SMTP_HOST          = 'smtp.hostinger.com';
const SMTP_PORT          = 465;                        // SSL
const SMTP_USER          = 'info@digifoxprosolutions.com';
const SMTP_PASSWORD_FILE = '.digifox-smtp-password';   // in the home folder, e.g. /home/u311568037/

date_default_timezone_set('Asia/Kolkata');
header('Content-Type: application/json; charset=utf-8');

function out($ok, $code = 200) { http_response_code($code); echo json_encode(['ok' => (bool)$ok]); exit; }
function clean($v, $max) {
    $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string)$v);
    return mb_substr(trim((string)$v), 0, $max, 'UTF-8');
}
function enc($s) { return '=?UTF-8?B?' . base64_encode($s) . '?='; }

/* ---------------- Sending ---------------- */

function smtp_password() {
    $homes = [getenv('HOME') ?: '', dirname(__DIR__, 4)];   // .../domains/<site>/public_html/quiz → home
    foreach ($homes as $h) {
        $f = rtrim($h, '/') . '/' . SMTP_PASSWORD_FILE;
        if ($h !== '' && @is_readable($f)) {
            $p = trim((string)@file_get_contents($f));
            if ($p !== '') return $p;
        }
    }
    return null;
}

// Minimal SMTP client (implicit TLS on port 465, AUTH LOGIN). Returns true when the server accepted the message.
function smtp_send($to, $replyTo, $subject, $extraHeaders, $body, $password) {
    $fp = @stream_socket_client('ssl://' . SMTP_HOST . ':' . SMTP_PORT, $errno, $errstr, 20);
    if (!$fp) { error_log("digifox quiz: SMTP connect failed: $errstr"); return false; }
    stream_set_timeout($fp, 30);
    $read = function () use ($fp) {
        $resp = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $resp .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;   // last line of a (multi-line) reply
        }
        return $resp;
    };
    // $label is what goes in the error log, so the login steps are never logged.
    $cmd = function ($line, $expect, $label = null) use ($fp, $read) {
        if ($line !== null) fwrite($fp, $line . "\r\n");
        $resp = $read();
        if ((int)substr($resp, 0, 3) !== $expect) {
            error_log('digifox quiz: SMTP ' . ($label ?? $line ?? 'reply') . ' -> ' . trim($resp));
            return false;
        }
        return true;
    };
    $domain = substr(strrchr(FROM_EMAIL, '@'), 1);
    $ok = $cmd(null, 220, 'greeting')
       && $cmd('EHLO ' . $domain, 250)
       && $cmd('AUTH LOGIN', 334)
       && $cmd(base64_encode(SMTP_USER), 334, 'login (user)')
       && $cmd(base64_encode($password), 235, 'login (password)')
       && $cmd('MAIL FROM:<' . FROM_EMAIL . '>', 250)
       && $cmd('RCPT TO:<' . $to . '>', 250)
       && $cmd('DATA', 354);
    if ($ok) {
        $msg = 'Date: ' . date('r') . "\r\n"
             . 'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . ">\r\n"
             . 'From: ' . enc(FROM_NAME) . ' <' . FROM_EMAIL . ">\r\n"
             . "To: <$to>\r\n"
             . "Reply-To: <$replyTo>\r\n"
             . "Subject: $subject\r\n"
             . $extraHeaders . "\r\n\r\n"
             . $body;
        $msg = preg_replace('/(?<!\r)\n/', "\r\n", $msg);
        $msg = preg_replace('/^\./m', '..', $msg);              // dot-stuffing
        fwrite($fp, rtrim($msg, "\r\n") . "\r\n.\r\n");
        $ok = $cmd(null, 250, 'end of message');
    }
    @fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return $ok;
}

// $extraHeaders: MIME headers only (MIME-Version, Content-Type, ...), lines joined with \r\n.
function send_mail($to, $replyTo, $subject, $extraHeaders, $body) {
    $subject = enc($subject);
    $password = smtp_password();
    if ($password !== null) return smtp_send($to, $replyTo, $subject, $extraHeaders, $body, $password);
    // Fallback until the SMTP password file exists on the server.
    $headers = 'From: ' . enc(FROM_NAME) . ' <' . FROM_EMAIL . ">\r\nReply-To: $replyTo\r\n" . $extraHeaders;
    return mail($to, $subject, $body, $headers, '-f' . FROM_EMAIL);
}

// A text/plain part plus one attachment.
function with_attachment($text, $mime, $filename, $data) {
    $b = 'dfq_' . bin2hex(random_bytes(12));
    $headers = "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$b\"";
    $body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($text))
          . "--$b\r\nContent-Type: $mime; name=\"$filename\"\r\n"
          . "Content-Transfer-Encoding: base64\r\n"
          . "Content-Disposition: attachment; filename=\"$filename\"\r\n\r\n"
          . chunk_split(base64_encode($data))
          . "--$b--\r\n";
    return [$headers, $body];
}

/* ---------------- Request ---------------- */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(false, 405);

// Only accept requests that come from the quiz page on your own site.
$src  = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$host = strtolower((string)parse_url($src, PHP_URL_HOST));
if (!in_array($host, ALLOWED_HOSTS, true)) out(false, 403);

$in = json_decode((string)file_get_contents('php://input', false, null, 0, 3000000), true);
if (!is_array($in)) out(false, 400);

$type  = (string)($in['type'] ?? '');
$name  = clean($in['name'] ?? '', 80);
$email = clean($in['email'] ?? '', 120);
$phone = clean($in['phone'] ?? '', 20);
$loc   = clean($in['location'] ?? '', 80);

if ($name === '' || $loc === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\+?[0-9 \-]{7,20}$/', $phone)) out(false, 422);

$plain = "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64";

// 1. Notice to Digifox when someone starts the test.
if ($type === 'start') {
    $body = "A participant has started the Digifox Quiz.\r\n\r\n"
          . "Name: $name\r\nEmail: $email\r\nPhone: $phone\r\nLocation: $loc\r\n"
          . 'Started: ' . date('d M Y, h:i A') . " IST\r\n";
    out(send_mail(ADMIN_EMAIL, $email, "Digifox Quiz: $name has started the test", $plain, chunk_split(base64_encode($body))));
}

// 2. Notice to Digifox with the participant's Google review screenshot (sent when they add it).
if ($type === 'review') {
    $score = (int)($in['score'] ?? 0);
    if ($score < PASS_MARK || $score > TOTAL) out(false, 422);

    $img = base64_decode((string)($in['image'] ?? ''), true);
    if ($img === false || strlen($img) > 1500000 || strncmp($img, "\xFF\xD8\xFF", 3) !== 0) out(false, 422);

    $text = "A participant has added their Google review screenshot (attached) and has been sent their certificate.\r\n\r\n"
          . "Name: $name\r\nEmail: $email\r\nPhone: $phone\r\nLocation: $loc\r\n"
          . "Score: $score / " . TOTAL . "\r\n"
          . 'Added: ' . date('d M Y, h:i A') . " IST\r\n\r\n"
          . "Google reviews: https://g.page/r/CY-wzdsLShK7EAE/review\r\n";
    $file = 'Review-screenshot-' . (preg_replace('/[^A-Za-z0-9]+/', '-', $name) ?: 'participant') . '.jpg';
    [$headers, $body] = with_attachment($text, 'image/jpeg', $file, $img);
    out(send_mail(ADMIN_EMAIL, $email, "Digifox Quiz: review screenshot from $name", $headers, $body));
}

// 3. Certificate email to the participant (score of 12 or more).
if ($type === 'certificate') {
    $score = (int)($in['score'] ?? 0);
    if ($score < PASS_MARK || $score > TOTAL) out(false, 422);

    $pdf = base64_decode((string)($in['pdf'] ?? ''), true);
    if ($pdf === false || strlen($pdf) > 1500000 || strncmp($pdf, '%PDF-', 5) !== 0) out(false, 422);

    $text = <<<TXT
Hello {$name},

Congratulations on completing the Digifox Quiz! 🎉

Thank you for participating in the Digifox Quiz by Digifox Pro Solutions. Your certificate of completion is a recognition of your effort and interest in learning digital skills.

🚀 Take the Next Step in Your Digital Journey!

Based on your quiz performance, you are eligible to attend our FREE DEMO CLASSES!

Join us every Sunday to explore digital marketing, discover practical strategies, and learn how you can build your skills for career growth, freelancing, or business success.

🎓 Free Demo Class Details

* Day: Every Sunday
* Time: 5:00 PM – 6:00 PM
* Fee: Absolutely FREE!

Ready to upgrade your digital skills? Enroll today and take the first step towards your digital future!

👉 Visit our website: https://digifoxprosolutions.com/

We look forward to welcoming you to our demo classes and helping you unlock your potential.

Best regards,
Team Digifox Pro Solutions
Complete Solution for Digital Era
🌐 https://digifoxprosolutions.com/
TXT;
    $text = str_replace(["\r\n", "\n"], ["\n", "\r\n"], $text);

    [$headers, $body] = with_attachment($text, 'application/pdf', 'Digifox-Quiz-Certificate.pdf', $pdf);
    out(send_mail($email, FROM_EMAIL, 'Your Digifox Quiz Certificate', $headers, $body));
}

out(false, 400);
