#include <emscripten/bind.h>
#include <libqalculate/qalculate.h>
#include <memory>
#include <stdexcept>

namespace {
std::unique_ptr<Calculator> instance;

emscripten::val messages() {
    auto result = emscripten::val::array();
    for (auto *message = instance->message(); message; message = instance->nextMessage()) {
        auto item = emscripten::val::object();
        item.set("severity", message->type() == MESSAGE_ERROR ? "error" :
                 message->type() == MESSAGE_WARNING ? "warning" : "info");
        item.set("text", message->message());
        result.call<void>("push", item);
    }
    return result;
}

emscripten::val calculate(const std::string &expression, int timeout_ms) {
    if (timeout_ms < 1 || timeout_ms > 10000) {
        emscripten::val::global("RangeError").new_(std::string("timeoutMs must be between 1 and 10000")).throw_();
    }
    instance->clearMessages();
    EvaluationOptions evaluation;
    evaluation.parse_options.angle_unit = ANGLE_UNIT_RADIANS;
    PrintOptions printing;
    printing.use_unicode_signs = true;
    printing.interval_display = INTERVAL_DISPLAY_SIGNIFICANT_DIGITS;
    bool approximate = false;
    printing.is_approximate = &approximate;
    bool result_is_comparison = false;
    std::string input;
    auto output = instance->calculateAndPrint(
        instance->unlocalizeExpression(expression, evaluation.parse_options),
        timeout_ms, evaluation, printing, AUTOMATIC_FRACTION_AUTO,
        AUTOMATIC_APPROXIMATION_AUTO, &input, -1, &result_is_comparison, true, 2, TAG_TYPE_HTML);
    auto result = emscripten::val::object();
    result.set("input", input);
    result.set("output", output);
    result.set("approximate", approximate);
    result.set("resultIsComparison", result_is_comparison);
    result.set("messages", messages());
    return result;
}
}

int main() {
    instance = std::make_unique<Calculator>(true);
    // Embedded snapshots only. This never calls fetchExchangeRates().
    if (!instance->loadExchangeRates()) throw std::runtime_error("Cannot load bundled exchange rates");
    if (!instance->loadGlobalDefinitions()) throw std::runtime_error("Cannot load embedded definitions");
    instance->clearMessages();
    return 0;
}

EMSCRIPTEN_BINDINGS(qalculate) {
    emscripten::function("calculate", &calculate);
}
