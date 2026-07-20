def double(x):
    return x * 2


def main():
    items = [1, 2, 3, 4, 5]
    total = 0
    for item in items:
        doubled = double(item)
        total += doubled
    print(f"items={[double(i) for i in items]} total={total}")


if __name__ == "__main__":
    main()
