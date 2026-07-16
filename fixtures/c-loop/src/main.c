#include <stdio.h>
#include <stdlib.h>

static int double_value(int x)
{
    return x * 2;
}

static char *summarize(const int *items, size_t count, long total)
{
    size_t needed = 64 + count * 8;
    char *buffer = malloc(needed);
    char *ptr = buffer;
    int written = sprintf(ptr, "items=[");
    ptr += written;
    for (size_t i = 0; i < count; ++i)
    {
        written = sprintf(ptr, "%d", items[i]);
        ptr += written;
        if (i + 1 < count)
            *ptr++ = ',';
        *ptr++ = ' ';
    }
    if (count > 0)
        ptr -= 1;
    written = sprintf(ptr, "] total=%ld", total);
    (void)written;
    return buffer;
}

int main(void)
{
    int items[] = {1, 2, 3, 4, 5};
    size_t count = sizeof(items) / sizeof(items[0]);
    long total = 0;

    for (size_t i = 0; i < count; ++i)
    {
        int doubled = double_value(items[i]);
        items[i] = doubled;
        total += doubled;
        printf("iteration %zu: doubled=%d total=%ld\n", i, doubled, total);
    }

    char *summary = summarize(items, count, total);
    printf("%s\n", summary);
    free(summary);
    return 0;
}
