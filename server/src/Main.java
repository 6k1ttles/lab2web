import com.fastcgi.FCGIInterface;

import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Main {
    private static final List<String> pointsHistory = new ArrayList<>();

    public static void main(String[] args) {
        FCGIInterface fastCGI = new FCGIInterface();
        while (fastCGI.FCGIaccept() >= 0) {
            long start = System.nanoTime();
            String method = FCGIInterface.request.params.getProperty("REQUEST_METHOD", "");
            String query = FCGIInterface.request.params.getProperty("QUERY_STRING", "");
            Response response = handleRequest(method, query, start);
            sendResponse(response);
        }
    }

    static Response handleRequest(String method, String query, long start) {
        if (!"GET".equals(method)) {
            return error(405, "Method Not Allowed", "Разрешён только GET-запрос.", start);
        }

        try {
            Map<String, String> params = parseQuery(query);
            if ("history".equals(params.get("action"))) {
                if (params.size() != 1) {
                    throw new IllegalArgumentException("Для истории нужен только action=history.");
                }
            } else {
                if (params.containsKey("action")) {
                    throw new IllegalArgumentException("Неизвестное действие.");
                }
                if (params.size() != 3 || !params.containsKey("x")
                        || !params.containsKey("y") || !params.containsKey("r")) {
                    throw new IllegalArgumentException("Передайте параметры x, y и r.");
                }

                BigDecimal xValue = parseNumber(params.get("x"), "X");
                BigDecimal yValue = parseNumber(params.get("y"), "Y");
                BigDecimal rValue = parseNumber(params.get("r"), "R");
                checkData(xValue, yValue, rValue);

                boolean hit = checkHit(xValue, yValue, rValue);
                String result = "{\"x\":\"" + xValue.toPlainString() + "\",\"y\":" + yValue.doubleValue()
                        + ",\"r\":" + rValue.intValue()
                        + ",\"hit\":" + hit + ",\"currentTime\":\"" + currentTime()
                        + "\",\"executionTimeMs\":" + elapsed(start) + "}";
                pointsHistory.add(0, result);
            }

            String json = "{\"results\":[" + String.join(",", pointsHistory)
                    + "],\"currentTime\":\"" + currentTime()
                    + "\",\"executionTimeMs\":" + elapsed(start) + "}";
            return new Response(200, "OK", json);
        } catch (IllegalArgumentException exception) {
            return error(400, "Bad Request", exception.getMessage(), start);
        } catch (Exception exception) {
            return error(500, "Internal Server Error", "Внутренняя ошибка сервера.", start);
        }
    }

    static Map<String, String> parseQuery(String query) {
        Map<String, String> params = new HashMap<>();
        if (query == null || query.isEmpty()) {
            return params;
        }
        for (String part : query.split("&", -1)) {
            String[] pair = part.split("=", 2);
            if (pair.length != 2 || pair[0].isEmpty()) {
                throw new IllegalArgumentException("Неверная строка запроса.");
            }
            String name;
            String value;
            try {
                name = URLDecoder.decode(pair[0], StandardCharsets.UTF_8);
                value = URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
            } catch (IllegalArgumentException exception) {
                throw new IllegalArgumentException("Неверная кодировка параметров.");
            }
            if (params.putIfAbsent(name, value) != null) {
                throw new IllegalArgumentException("Параметры не должны повторяться.");
            }
        }
        return params;
    }

    static BigDecimal parseNumber(String text, String name) {
        String value = text.trim().replace(',', '.');
        if (!value.matches("[+-]?(\\d+(\\.\\d*)?|\\.\\d+)")) {
            throw new IllegalArgumentException(name + " должен быть числом.");
        }
        return new BigDecimal(value);
    }

    static void checkData(BigDecimal x, BigDecimal y, BigDecimal r) {
        if (x.compareTo(BigDecimal.valueOf(-3)) <= 0 || x.compareTo(BigDecimal.valueOf(5)) >= 0) {
            throw new IllegalArgumentException("X должен быть больше -3 и меньше 5.");
        }
        if (y.abs().compareTo(BigDecimal.valueOf(2)) > 0
                || y.multiply(BigDecimal.valueOf(2)).stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("Y выбирается от -2 до 2 с шагом 0,5.");
        }
        if (r.compareTo(BigDecimal.ONE) < 0 || r.compareTo(BigDecimal.valueOf(5)) > 0
                || r.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("R должен быть целым числом от 1 до 5.");
        }
    }

    static boolean checkHit(BigDecimal x, BigDecimal y, BigDecimal r) {
        boolean triangle = x.signum() >= 0 && y.signum() >= 0 && x.add(y).compareTo(r) <= 0;
        boolean rectangle = x.signum() >= 0 && x.compareTo(r.divide(BigDecimal.valueOf(2))) <= 0
                && y.signum() <= 0 && y.compareTo(r.negate()) >= 0;
        boolean circle = x.signum() <= 0 && y.signum() <= 0
                && x.multiply(x).add(y.multiply(y)).compareTo(r.multiply(r)) <= 0;
        return triangle || rectangle || circle;
    }

    private static String currentTime() {
        return OffsetDateTime.now().toString();
    }

    private static double elapsed(long start) {
        return (System.nanoTime() - start) / 1_000_000.0;
    }

    private static Response error(int status, String reason, String message, long start) {
        String json = "{\"error\":\"" + message + "\",\"currentTime\":\"" + currentTime()
                + "\",\"executionTimeMs\":" + elapsed(start) + "}";
        return new Response(status, reason, json);
    }

    private static void sendResponse(Response response) {
        byte[] body = response.body.getBytes(StandardCharsets.UTF_8);
        String headers = "HTTP/1.1 " + response.status + " " + response.reason + "\r\n"
                + "Content-Type: application/json; charset=UTF-8\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + (response.status == 405 ? "Allow: GET\r\n" : "")
                + "\r\n";
        System.out.write(headers.getBytes(StandardCharsets.US_ASCII), 0, headers.length());
        System.out.write(body, 0, body.length);
        System.out.flush();
    }

    static class Response {
        final int status;
        final String reason;
        final String body;

        Response(int status, String reason, String body) {
            this.status = status;
            this.reason = reason;
            this.body = body;
        }
    }
}
