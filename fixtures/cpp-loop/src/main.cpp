#include <iostream>
#include <sstream>
#include <string>
#include <vector>

int doubleValue(int x) {
    return x * 2;
}

std::string summarize(const std::vector<int> &items, long total) {
    std::ostringstream oss;
    oss << "items=[";
    for (size_t i = 0; i < items.size(); ++i) {
        oss << items[i];
        if (i + 1 < items.size()) oss << ", ";
    }
    oss << "] total=" << total;
    return oss.str();
}

int main() {
    std::vector<int> items = {1, 2, 3, 4, 5};
    long total = 0;

    for (size_t i = 0; i < items.size(); ++i) {
        int doubled = doubleValue(items[i]);
        items[i] = doubled;
        total += doubled;
        std::cout << "iteration " << i << ": doubled=" << doubled << " total=" << total << "\n";
    }

    std::string summary = summarize(items, total);
    std::cout << summary << "\n";
    return 0;
}
