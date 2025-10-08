# Задание 1
def is_valid_email(text):
    if '@'and '.ru' in text :
        print(True)
    else:
        print(False)
is_valid_email("Mike@alabuga.ru")

# Задание 4
from typing import List
def filter_even_numbers(text:List):
    s = 0
    for i in text:
        if i % 2 == 0:
            print(i)
filter_even_numbers([1,2,3,4,5,6,7])

# Задание 5
def is_palindrome(text):
    if text[:3]==text[:-2]:
        print(True)
    else:
       print(False)
is_palindrome("lewel")

#Задача 6
d = tuple()
def find_max_min(text):
    d = (max(text),min(text))
    print(d)
find_max_min([1,2,3,4,5])

# Задача 7
d = list()
def sum_of_squares(text:int):
    for s in text:
        s = s**2
        d.append(s)
        print(sum(d))
s = sum_of_squares([1,2,3])

# Задача 8
def get_students(name):
    for i in name:
        if i[0]== "A":
            print(i)
        if i[0]== "B":
            print(i)
        if i[0]== "I":
            print(i)
get_students(name=["Albert","Boris","Igor"])