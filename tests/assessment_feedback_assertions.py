"""Validate active DTO privacy, allowing keys only for committed mock questions."""
def check_active_feedback_privacy(attempt):
    assert attempt['status']=='active'
    for key in ['correctIndex','explanation','snapshot','review','result','importReview']:
        assert key not in attempt,key
    for question in attempt['questions']:
        assert set(question)=={'prompt','options','topic'},question
    if attempt.get('feedbackMode')=='after_answer':
        feedback=attempt['feedback'];assert len(feedback)==len(attempt['questions'])
        for i,answer in enumerate(attempt['answers']):
            item=feedback[i]
            if answer is None:assert item is None,(i,item)
            else:
                assert set(item)=={'correctIndex','selectedIndex','correct'},item
                assert item['selectedIndex']==answer
                assert isinstance(item['correctIndex'],int) and 0<=item['correctIndex']<len(attempt['questions'][i]['options'])
                assert item['correct']==(answer==item['correctIndex'])
    else:assert 'feedback' not in attempt
