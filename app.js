const express = require('express');
const sqlite3 = require('sqlite3');
const {open} = require('sqlite');
const path = require('path');
const {format, isValid} = require('date-fns');

const expressAppInstance = express();
expressAppInstance.use(express.json())

let dataBaseConnectionObject;
let dbPath = path.join(__dirname, "todoApplication.db")

const initializeDatabaseAndServer = async()=>{
    
    try{
        dataBaseConnectionObject = await open({
            filename : dbPath,
            driver:sqlite3.Database
        })
        expressAppInstance.listen(3000, ()=>{
            console.log("Database and server are initiated and the server started listening at the port 3000")
        })
    }catch(e){
        console.log(`Database Error ${e.message}`)
    }
}

initializeDatabaseAndServer()

const checkStatus = (request, response, next)=>{
    const {status} = request.body;
    const possibleStatusValuesArray = ["TO DO", "IN PROGRESS", "DONE"];
    const isStatusValid = possibleStatusValuesArray.includes(status) ? true : false 
    if (isStatusValid){
        next()
        request.statusValid = true;
    }else{
        response.status(400)
        response.send("Invalid Todo Status")
        request.statusValid = false;
    }
}

const checkPriority = (request, response, next)=>{
    const {priority} = request.body;
    const possiblePriorityValuesArray = ['HIGH', 'MEDIUM', 'LOW'];
    const isPriorityValid = possiblePriorityValuesArray.includes(priority) ? true : false 
    if (isPriorityValid){
        next()
        request.prioryValid = true;
    }else{
        response.status(400)
        response.send("Invalid Todo Priority")
        request.prioryValid = false;
    }
}

const checkCategory = (request, response, next)=>{
    const {category} = request.body;
    const possibleCategoryArray = ['WORK', "HOME", 'LEARNING'];
    const isCategoryValid = possibleCategoryArray.includes(category) ? true : false 
    if (isCategoryValid){
        next()
        request.categoryValid = true;
    }else{
        response.status(400)
        response.send("Invalid Todo Category")
        request.categoryValid = false;
    }
}

const isDateValid = (request, response, next)=>{
    const {dueDate} = request.body;
    try{
        const dateObj = new Date(dueDate)
        const dueDateString = format(dateObj, "yyyy-MM-dd")
        request.body["due_date"] = dueDateString
        next()
        request.dueDate = true;
    }catch(e){
        response.status(400)
        response.send('Invalid Due Date')
        request.dueDate = false;
    }
}

const validateQuery = (request, response, next)=>{
    const {search_q, category, status, priority} = request.query;
    let countOfTruetyValues = 0;
    let invalidVar = [];
    let countOfValidValues = 0;
    let countOfUndefinedVar = 0;

    for(let eachProp in request.query){
        if (request.query[eachProp]){
            countOfTruetyValues += 1
        }else{
            countOfUndefinedVar += 1
        }
    }
    
    if(category){
        if(['WORK', "HOME", "LEARNING"].includes(category)){
            countOfValidValues += 1
        }else{
            invalidVar.push('Category')
        }
    }

    if(status){
        if(["IN PROGRESS", "TO DO", "DONE"].includes(status)){
            countOfValidValues += 1
        }else{
            invalidVar.push('Status')
        }
    }

    if(priority){
        if(['HIGH', 'MEDIUM', 'LOW'].includes(priority)){
            countOfValidValues += 1
        }else{
            invalidVar.push('Priority')
        }
    }

    if (countOfTruetyValues === countOfValidValues || invalidVar.length === 0){
        next()
    }else{
        let invalidValuesString = invalidVar.join(" ")
        response.status(400)
        response.send(`Invalid Todo ${invalidValuesString}`)
    }
}


//getTodosAPI API-1

expressAppInstance.get('/todos/', validateQuery, async(request, response)=>{
    const{search_q = "", category = "", status = "", priority = ""} = request.query;

    console.log(search_q, category, status, priority)

    const getTodosQuery = `SELECT id, todo, priority, status, category, due_date as dueDate FROM todo
    WHERE todo like "%${search_q}%" and category like "%${category}%" and status like "%${status}%" and priority like "%${priority}%";`;

    try{
        let arrayOfTodoObjects = await dataBaseConnectionObject.all(getTodosQuery)
        response.send(arrayOfTodoObjects)
    }catch(e){
        console.log(`Error message ${e.message}`)
    }

})

//getTodo API-2
expressAppInstance.get('/todos/:todoId/', async(request, response)=>{
    const{todoId} = request.params;
    const getTodoQuery = `SELECT id, todo, priority, status, category, due_date AS dueDate FROM todo WHERE id = ${todoId}`
    try{
        let todoItem = await dataBaseConnectionObject.get(getTodoQuery);
        response.send(todoItem)
    }catch(e){
        console.log(`Database error ${e.message}`)
    }
})

//getTodosWithDate - GET API-3
expressAppInstance.get("/agenda/", async(request, response)=>{
    let{date} = request.query;
    try{
        date = format(new Date(date), "yyyy-MM-dd")
        const getTodosWithDateQuery = `SELECT id, todo, priority, status, category, due_date as dueDate FROM todo WHERE due_date like "${date}"`
        try{
            let arrayOfTodoObjects = await dataBaseConnectionObject.all(getTodosWithDateQuery)
            response.send(arrayOfTodoObjects)
        }catch(e){
        console.log(`Datebase Error ${e.message}`)
    }
    }catch(e){
        response.status(400)
        response.send("Invalid Due Date")
    }
    
})

//CreateTodoAPI - POST - API-4
expressAppInstance.post('/todos/',checkCategory,checkPriority,checkStatus, isDateValid, async(request, response)=>{
    const {id, category, status, priority, dueDate, todo} = request.body;
    //console.log(id, category, status, priority, dueDate, todo)
    const createTodoQuery = `INSERT INTO todo(id, category, status, priority, due_date, todo)
    VALUES(${id}, "${category}", "${status}", "${priority}", "${dueDate}", "${todo}");`;

    try{
        await dataBaseConnectionObject.run(createTodoQuery);
        response.send('Todo Successfully Added')
    }catch(e){
        console.log(`Database Error ${e.message}`)
    }
})


//updateTodoAPI PUT API-5
expressAppInstance.put("/todos/:todoId", async(request, response)=>{
    const{todoId} = request.params;
    const getTodoQuery = `SELECT id, todo, priority, status, category, due_date AS dueDate FROM todo WHERE id = ${todoId}`
    let previousTodoItem; //For maintaining the exiting record of todoItem
    try{
        previousTodoItem = await dataBaseConnectionObject.get(getTodoQuery);
    }catch(e){
        console.log(`Database error ${e.message}`)
    }
    
    const requestedProperty = Object.keys(request.body)[0]; //extracted the property of request body
    let value = Object.values(request.body)[0];//extracted the value of request body

    //if the user given input is valid, the dateBase would be updated with new value
    const updateTheDataBase = async(newObject)=>{
        const {id, status, category, dueDate, priority, todo} = newObject
        const updateTodoQuery = `UPDATE todo SET id = ${id}, status = "${status}", priority = "${priority}", category = "${category}", todo = "${todo}", due_date = "${dueDate}" WHERE id=${id};`
        try{
            await dataBaseConnectionObject.run(updateTodoQuery)
        }catch(e){
            console.log(`Database Error ${e}`)
        }
    }

    //Based on users preference, the property of todoItem would be updated.
    switch(requestedProperty){
        case "todo":
            previousTodoItem[requestedProperty] = value;
            updateTheDataBase(previousTodoItem);
            response.send('Todo Updated');
            break;
        case "category":
            if(['WORK', "HOME", 'LEARNING'].includes(value)){
                previousTodoItem[requestedProperty] = value;
                updateTheDataBase(previousTodoItem);
                response.send('Category Updated')
            }else{
                response.status(400)
                response.send("Invalid Todo Category")
            }
            break;
        case "status":
            if (["TO DO", "IN PROGRESS", "DONE"].includes(value)){
                previousTodoItem[requestedProperty] = value;
                updateTheDataBase(previousTodoItem);
                response.send("Status Updated")
            }else{
                response.status(400)
                response.send("Invalid Todo Status")
            }
            break;
        case "priority":
            if (["HIGH", "MEDIUM", "LOW"].includes(value)){
                previousTodoItem[requestedProperty] = value;
                updateTheDataBase(previousTodoItem);
                response.send("Priority Updated")
            }else{
                response.status(400)
                response.send("Invalid Todo Priority")
            }
            break;
        case "dueDate":
            try{
                let dateObj = new Date(value);
                value = format(dateObj, "yyyy-MM-dd")
                previousTodoItem[requestedProperty] = value;
                updateTheDataBase(previousTodoItem)
                response.send("Due Date Updated")
            }catch(e){
                response.status(400)
                response.send("Invalid Due Date")
            }    
    }


})


//deleteTodo - DELETE - API-6
expressAppInstance.delete('/todos/:todoId/', async(request, response)=>{
    const {todoId} = request.params;
    const deleteTodoQuery = `DELETE FROM todo WHERE id=${todoId}`
    try{
        await dataBaseConnectionObject.run(deleteTodoQuery);
        response.send(`Todo Deleted`);
    }catch(e){
        console.log(`Database error ${e.message}`)
    }
})

module.exports = expressAppInstance